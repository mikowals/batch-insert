
var MongoDB = NpmModuleMongodb;

//Need LocalCollection._ObjectID for type checking
LocalCollection = {};
LocalCollection._ObjectID = function (hexString) {
  //random-based impl of Mongo ObjectID
  self._str = Random.hexString(24);
};

// This is used to add or remove EJSON from the beginning of everything nested
// inside an EJSON custom type. It should only be called on pure JSON!
var replaceNames = function (filter, thing) {
  if (typeof thing === "object") {
    if (_.isArray(thing)) {
      return _.map(thing, _.bind(replaceNames, null, filter));
    }
    var ret = {};
    _.each(thing, function (value, key) {
      ret[filter(key)] = replaceNames(filter, value);
    });
    return ret;
  }
  return thing;
};

// Ensure that EJSON.clone keeps a Timestamp as a Timestamp (instead of just
// doing a structural clone).
// XXX how ok is this? what if there are multiple copies of MongoDB loaded?
MongoDB.Timestamp.prototype.clone = function () {
  // Timestamps should be immutable.
  return this;
};

var makeMongoLegal = function (name) { return "EJSON" + name; };
var unmakeMongoLegal = function (name) { return name.substr(5); };

var replaceMongoAtomWithMeteor = function (document) {
  if (document instanceof MongoDB.Binary) {
    var buffer = document.value(true);
    return new Uint8Array(buffer);
  }
  if (document instanceof MongoDB.ObjectID) {
    return new Mongo.ObjectID(document.toHexString());
  }
  if (document["EJSON$type"] && document["EJSON$value"]
      && _.size(document) === 2) {
    return EJSON.fromJSONValue(replaceNames(unmakeMongoLegal, document));
  }
  if (document instanceof MongoDB.Timestamp) {
    // For now, the Meteor representation of a Mongo timestamp type (not a date!
    // this is a weird internal thing used in the oplog!) is the same as the
    // Mongo representation. We need to do this explicitly or else we would do a
    // structural clone and lose the prototype.
    return document;
  }
  return undefined;
};

var replaceMeteorAtomWithMongo = function (document) {
  if (EJSON.isBinary(document)) {
    // This does more copies than we'd like, but is necessary because
    // MongoDB.BSON only looks like it takes a Uint8Array (and doesn't actually
    // serialize it correctly).
    return new MongoDB.Binary(new Buffer(document));
  }
  if (document instanceof Mongo.ObjectID) {
    return new MongoDB.ObjectID(document.toHexString());
  }
  if (document instanceof MongoDB.Timestamp) {
    // For now, the Meteor representation of a Mongo timestamp type (not a date!
    // this is a weird internal thing used in the oplog!) is the same as the
    // Mongo representation. We need to do this explicitly or else we would do a
    // structural clone and lose the prototype.
    return document;
  }
  if (EJSON._isCustomType(document)) {
    return replaceNames(makeMongoLegal, EJSON.toJSONValue(document));
  }
  // It is not ordinarily possible to stick dollar-sign keys into mongo
  // so we don't bother checking for things that need escaping at this time.
  return undefined;
};

var replaceTypes = function (document, atomTransformer) {
  if (typeof document !== 'object' || document === null)
    return document;

  var replacedTopLevelAtom = atomTransformer(document);
  if (replacedTopLevelAtom !== undefined)
    return replacedTopLevelAtom;

  var ret = document;
  _.each(document, function (val, key) {
    var valReplaced = replaceTypes(val, atomTransformer);
    if (val !== valReplaced) {
      // Lazy clone. Shallow copy.
      if (ret === document)
        ret = _.clone(document);
      ret[key] = valReplaced;
    }
  });
  return ret;
};

var getIdsFromMongoResult = function(res){
  res = res.ops;
  res = replaceTypes( res, replaceMongoAtomWithMeteor);
  return _.pluck( res, '_id');
}

var wrapCB = function (cb) {
  return Meteor.bindEnvironment(function(err, result){
    if (err){
      return cb(err);
    }
    result = getIdsFromMongoResult(result)
    cb( null, result);
  })

};

_batchInsert = function (collection, docs, cb) {
  var connection = MongoInternals.defaultRemoteCollectionDriver().mongo;
  var write = connection._maybeBeginWrite();
  var _collection = collection.rawCollection();
  var wrappedInsert = Meteor.wrapAsync( _collection.insertMany, _collection );
  if (cb){
    return wrappedInsert( replaceTypes( docs, replaceMeteorAtomWithMongo), {safe:true}, wrapCB(cb));
  } 
 
  var result = wrappedInsert( replaceTypes( docs, replaceMeteorAtomWithMongo ), {safe:true});
  
  result = getIdsFromMongoResult(result)
  docs.forEach( function( doc ){
    Meteor.refresh( { collection: collection._name, id: doc._id } );
  });
   
  write.committed();
  return result;
}



