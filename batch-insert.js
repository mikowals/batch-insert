Mongo.Collection.prototype._defineBatchInsert = function(){
  var self = this;
  console.log( 'defining batchInsert: ', self._name);
  var m = {};
  m['/' + self._name + '/batchInsert'] = function( docs ){
    check( docs, [Object]);

    docs.forEach( function ( doc ){
      /*if (!(self._collection._isPlainObject( doc ) &&
        !EJSON._isCustomType( doc ))) {

          throw new Meteor.Error( 403, "Only plain objects may be inserted into MongoDB");

      }*/
    });

    var generatedIds = docs.map( function( doc ){
      if( !_.has( doc, '_id') ){
        var newId = self._makeNewID();
        return newId;
      } else
        return doc._id;
    });

    // 'this' refers to method context
    if ( this.isSimulation){
      //var _collection = Meteor.connection._mongo_livedata_collections[ self._name ];
      return docs.map( function( doc, ii){
        doc._id = generatedIds[ii];
        return self.insert( doc );
      });

    }

    //client returned so server code below
    docs.forEach( function( doc, ii ){
      doc._id = generatedIds[ ii ];
    });

    var connection = MongoInternals.defaultRemoteCollectionDriver().mongo;
    var write = connection._maybeBeginWrite();
    var _collection = connection._getCollection( self._name );
    var wrappedInsert = Meteor.wrapAsync( _collection.insert ).bind( _collection );
    var result = wrappedInsert( docs, {w:1} );
    docs.forEach( function( doc ){
      Meteor.refresh( { collection: self._name, id: doc._id } );
    });
    write.committed();
    return _.pluck( result , '_id');

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
