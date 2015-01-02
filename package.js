Package.describe({
  summary: "Insert multiple documents to mongo collection with one db call.",
  version: "1.1.2.1",
  name: "mikowals:batch-insert",
  git: "https://github.com/mikowals/batch-insert.git"
});

Package.onUse( function( api ) {
  //api.versionsFrom('METEOR@0.9.3');
  api.use(['mongo', 'underscore']);
  api.imply(['mongo','minimongo']);
  api.addFiles('batch-insert.js');
});

Package.onTest( function( api ) {
  api.use(['tinytest','test-helpers', 'random', 'mongo']);
  api.use('mikowals:batch-insert');
  api.addFiles('batch-insert-tests.js');
});
