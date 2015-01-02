
//Need LocalCollection._ObjectID for type checking
var LocalCollection = {};
LocalCollection._ObjectID = function (hexString) {
  //random-based impl of Mongo ObjectID
  self._str = Random.hexString(24);
};

Mongo.Collection.prototype._defineBatchInsert = function(){
  var self = this;

  // don't define a method for a null collection
  if ( ! self._name ) return;
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
    var batchSecret = Random.secret( 8 );
    var generatedIds = docs.map( function( doc ){
      if( !_.has( doc, '_id') ){
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

      doc._id = generatedIds[ii];
      doc.batch = batchSecret;
    }, this );  // pass context of method into forEach

    var connection = MongoInternals.defaultRemoteCollectionDriver().mongo;
    var write = connection._maybeBeginWrite();
    var _collection = connection._getCollection( self._name );
    var wrappedInsert = Meteor.wrapAsync( _collection.insert ).bind( _collection );
    try {
      var result = wrappedInsert( docs, {w:1} );
      self.update( {batch: batchSecret}, {$unset: {batch: 1}}, {multi: true}, function(){ return });
    } catch( e ){
      var res = self.remove( {batch: batchSecret });
      throw e;
    }

    docs.forEach( function( doc ){
      Meteor.refresh( { collection: self._name, id: doc._id } );
    });
    write.committed();

    return _.pluck( result , '_id');
    //end of method definition
  };

  self._connection.methods( m );
};

Mongo.Collection.prototype.batchInsert = function( /*args*/ ){
  var self = this;
  if ( ! self._name ) return;
  var args = _.toArray(arguments);
  var cb;
  if (typeof args[ args.length - 1] === 'function'){
    cb = args.pop();
    return self._connection.apply( '/'+ self._name + '/batchInsert', args, {returnStubValue: true}, cb );
  }
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
