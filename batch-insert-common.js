if ( Meteor.isServer ){
  var MongoDB = Npm.require('mongodb');

  //Need LocalCollection._ObjectID for type checking
  var LocalCollection = {};
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
  
  var _batchInsert = function (collection, docs) {
    var connection = MongoInternals.defaultRemoteCollectionDriver().mongo;
    var write = connection._maybeBeginWrite();
    var _collection = collection.rawCollection();
    var wrappedInsert = Meteor.wrapAsync( _collection.insert, _collection );

    var result = wrappedInsert( replaceTypes( docs, replaceMeteorAtomWithMongo ), {safe:true} );

    docs.forEach( function( doc ){
      Meteor.refresh( { collection: collection._name, id: doc._id } );
    });
    write.committed();
    return _.pluck( replaceTypes( result, replaceMongoAtomWithMeteor) , '_id');
  }
}

Mongo.Collection.prototype._defineBatchInsert = function(){
  var self = this;

  // don't define a method for a null collection
  if ( ! self._name || ! self._connection ) return;
  var m = {};

  m['/' + self._name + '/batchInsert'] = function( docs ){
    check( docs, [Object]);
    // 'this' refers to method context
    if ( this.isSimulation){
      return docs.map( function( doc ){
        if (! doc._id)
          doc._id = self._makeNewID();
        return self.insert( doc );
      });
    }

    //client returned so server code below
    var userId = this.userId;
    var generatedIds = docs.map( function( doc ){
      if( ! _.has( doc, '_id') ){
        return self._makeNewID();
      } else
        return doc._id;
    });

    docs.forEach( function( doc, ii ){
      if ( this.connection ) {
        //server method called by client so check allow / deny rules.
        if (!( (doc && _type(doc) ) &&
              !EJSON._isCustomType(doc))) {
           throw new Error("Invalid modifier. Modifier must be an object.");
        }
        // call user validators.
        // Any deny returns true means denied.
        if (_.any(self._validators.insert.deny, function(validator) {
          return validator(userId, docToValidate(validator, doc, generatedIds[ii]));
        })) {
          throw new Meteor.Error(403, "Access denied");
        }
        // Any allow returns true means proceed. Throw error if they all fail.
        if (_.all(self._validators.insert.allow, function(validator) {
          return !validator(userId, docToValidate(validator, doc, generatedIds[ii]));
        })) {
          throw new Meteor.Error(403, "Access denied");
        }
      }

      doc._id =  generatedIds[ii];
    }, this );  // pass context of method into forEach
    return _batchInsert(self, docs);
    //end of method definition
  };

  self._connection.methods( m );
};

Mongo.Collection.prototype.batchInsert = function( /*args*/ ){
  var self = this;

  var args = _.toArray(arguments);
  var cb;
  if (typeof args[ args.length - 1] === 'function'){
    cb = args.pop();
  }

  if ( ! self._name || ! self._connection) {
    var res, err;
    try {
      res = args[0].map( function( doc ){
        return self._collection.insert( doc );
      });
    } catch (e){
      if ( ! cb )
        throw e;
      err = e;
    };
    cb && cb( err, res );

    return res;
  } else if (self._connection && self._connection === Meteor.server) {
    docs = args[0].map( function (doc){
      if (! doc._id) doc._id = self._makeNewID();
      return doc;
    })
    return _batchInsert( self, docs);
  }
  if ( cb )
    return self._connection.apply( '/'+ self._name + '/batchInsert', args, {returnStubValue: true}, cb );

  return self._connection.apply( '/'+ self._name + '/batchInsert', args, {returnStubValue: true});
};

var original = Mongo.Collection;
//_.extend ( original, Mongo.Collection );

Mongo.Collection = function( name, options ){
  original.call( this, name, options );
  this._defineBatchInsert();
};

Mongo.Collection.prototype = Object.create( original.prototype );
Mongo.Collection.prototype.constructor = Mongo.Collection;

_.extend( Mongo.Collection, original);

Meteor.Collection = Mongo.Collection;

//function copied from MDG Mongo.Collection._validateInsert.  Needed in allow / deny checks.

function docToValidate(validator, doc, generatedId) {
  var ret = doc;
  if (validator.transform) {
    ret = EJSON.clone(doc);
    // If you set a server-side transform on your collection, then you don't get
    // to tell the difference between "client specified the ID" and "server
    // generated the ID", because transforms expect to get _id.  If you want to
    // do that check, you can do it with a specific
    // `C.allow({insert: f, transform: null})` validator.
    if (generatedId !== null) {
      ret._id = generatedId;
    }
    ret = validator.transform(ret);
  }
  return ret;
};

function _type (v) {
  if (typeof v === "number")
    return 1;
  if (typeof v === "string")
    return 2;
  if (typeof v === "boolean")
    return 8;
  if ( _.isArray(v) )
    return 4;
  if (v === null)
    return 10;
  if (v instanceof RegExp)
    // note that typeof(/x/) === "object"
    return 11;
  if (typeof v === "function")
    return 13;
  if (v instanceof Date)
    return 9;
  if (EJSON.isBinary(v))
    return 5;
  if (v instanceof LocalCollection._ObjectID)
    return 7;

  return 3; // object

    // XXX support some/all of these:
    // 14, symbol
    // 15, javascript code with scope
    // 16, 18: 32-bit/64-bit integer
    // 17, timestamp
    // 255, minkey
    // 127, maxkey
};
