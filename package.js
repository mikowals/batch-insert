Package.describe({
  summary: "Insert multiple documents to mongo collection with one db call.",
  version: "1.1.4",
  name: "mikowals:batch-insert",
  git: "https://github.com/mikowals/batch-insert.git"
});

Npm.depends({
  mongodb: "https://github.com/meteor/node-mongodb-native/tarball/cbd6220ee17c3178d20672b4a1df80f82f97d4c1"
});

Npm.strip({
  mongodb: ["test/"]
});

Package.onUse( function( api ) {
  api.versionsFrom('METEOR@0.9.3');
  api.use(['mongo', 'ddp','ejson','underscore']);
  api.use('insecure', {weak: true});
  api.imply(['mongo', 'ddp']);
  api.addFiles('batch-insert.js');
});

Package.onTest( function( api ) {
  api.use(['tinytest','test-helpers', 'random', 'mongo']);
  api.use('mikowals:batch-insert');
  api.addFiles('batch-insert-tests.js');
});
