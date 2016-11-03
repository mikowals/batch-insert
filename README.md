##If you find this package useful consider commenting on the https://github.com/meteor/meteor/issues/1255 to get bulk insert support directly in Meteor core.



#batch-insert

Meteor package enabling mongo driver insert of multiple documents.

#Installation

In your meteor app directory run:

    meteor add mikowals:batch-insert

#Usage

The package creates a batchInsert() function on each collection instance.  It is designed to work just like insert() but takes an array of objects to be inserted rather than a single object.

    // on server and client
    Data = new Meteor.Collection('data');

    // must have an allow function on server to use batchInsert() on client.
    Data.allow({
      insert: function(){ return true };
    });

    // on server or client
    var newIds = Data.batchInsert([{item: junk},{item: garbage}]);  // returns array of created _id values

    // use asynchronously on client or server.  
    // On client it also synchronously returns _ids just like Mongo.Collection.insert().
    var moreIds = Data.batchInsert([{item: junk2},{item: garbage2}], function( err, res){
      //called with err or res where res is array of created _id values
    });  

Client side security is managed with allow / deny rules on the collection.  There is no security on batchInsert() done from the server.

