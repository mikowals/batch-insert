# batch-insert

Meteor package enabling insert of multiple documents while maintaining reactivity and respecting `allow` and `deny` rules.

If you find this package useful consider commenting at https://github.com/meteor/meteor-feature-requests/issues/15 to get bulk insert support directly in Meteor core.

# Installation

In your meteor app directory run:

    meteor add mikowals:batch-insert

# Usage

The package adds a `batchInsert()` function on each collection instance.  It works just like `insert()` but takes an array of objects and returns an array of `_id`s.

On the client, the `_id`s are available synchronously.  Client-side security is managed with allow / deny rules on the collection.  

On the server, inserted documents are published to subscribed clients when the `batchInsert` completes successfully.

    // on server and client
    Data = new Meteor.Collection('data');

    // must have an allow function on server to use batchInsert() on client.
    Data.allow({
      insert: function(){ return true };
    });

    // on server or client
    var newIds = Data.batchInsert([{item: junk},{item: garbage}]);  // returns array of created _id values

    // use asynchronously on client or server.  
    var moreIds = Data.batchInsert([{item: junk2},{item: garbage2}], function( err, res){
      //called with err or res where res is array of created _id values
    });  



