## v.1.1.3
* don't define batchInsert for a null collection.

## v.1.1.2
* all inserts in a batch fail if any insert fails.

## v.1.1.1

* mimic insert behaviour with check of LocalCollection.isPlainObject() before sending to db.

## v.1.1.0

* make batchInsert() function for Mongo.Collection instances to mimic behaviour of insert().

* check insert allow / deny rules on all objects to be inserted before inserting any objects.

* refactor to enable the above behaviours so that the /*collection name*/batchInsert Meteor.method has access to the collection instance

## v.1.0.0

* create batchInsert Meteor.method that uses the node mongo drivers batch insert capability to speed up multiple inserts

* client side inserts are secured with simple check whether the Meteor.user making the request has {admin: true}
