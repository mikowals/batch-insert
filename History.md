## v.1.3.0

- allow Mongo Node Driver 4.3.1 enabling Mongo 5.0

## v.1.1.13

- make sure writefence concludes for async server calls

## v.1.1.12

- release for meteor-1.2

## v.1.1.11

- release for meteor-1.2-rc.17

## v.1.1.10

- for meteor@1.2-rc.17
- fix [#5](https://github.com/mikowals/batch-insert/issues/5) - bad error handling on server calls

## v.1.1.9

- make LocalCollection accessible from all package files
- make sure callbacks get called from server only calls

## v.1.1.8

- batchInsert() called in server method ignores allow/deny rules

## v.1.1.7

- use .rawCollection() from meteor 1.0.4

## v.1.1.5

- proper handling for collections with ObjectIDs for \_id
- update mongodb driver

## v.1.1.3

- don't define batchInsert for a null collection.

## v.1.1.2

- all inserts in a batch fail if any insert fails.

## v.1.1.1

- mimic insert behaviour with check of LocalCollection.isPlainObject() before sending to db.

## v.1.1.0

- make batchInsert() function for Mongo.Collection instances to mimic behaviour of insert().

- check insert allow / deny rules on all objects to be inserted before inserting any objects.

- refactor to enable the above behaviours so that the /_collection name_/batchInsert Meteor.method has access to the collection instance

## v.1.0.0

- create batchInsert Meteor.method that uses the node mongo drivers batch insert capability to speed up multiple inserts

- client side inserts are secured with simple check whether the Meteor.user making the request has {admin: true}
