Package.describe({
  summary: "Speed up multiple inserts by using MongoDB batch insert",
  version: "1.1.0",
  name: "mikowals:batch-insert"
  //git: " \* Fill me in! *\ "
});

Package.onUse( function( api ) {
  api.versionsFrom('METEOR@0.9.3');
  api.use(['mongo', 'underscore']);
  api.addFiles('batch-insert.js');
});

Package.onTest( function( api ) {
  api.use(['tinytest','test-helpers', 'random', 'mongo']);
  api.use('mikowals:batch-insert');
  api.addFiles('batch-insert-tests.js');
});
