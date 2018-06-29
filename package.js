Package.describe({
  summary: "Insert multiple documents to mongo collection with one db call.",
  version: "1.1.14",
  name: "mikowals:batch-insert",
  git: "https://github.com/mikowals/batch-insert.git"
});

Npm.strip({
  mongodb: ["test/"]
});

Package.onUse( function( api ) {
  api.versionsFrom('1.7');
  api.use('npm-mongo', 'server');
  api.use(['mongo', 'ddp','ejson','underscore', 'check']);
  api.use('insecure', {weak: true});
  api.imply(['mongo', 'ddp']);
  api.addFiles('batch-insert-server.js','server');
  api.addFiles('batch-insert-common.js');
});

Package.onTest( function( api ) {
  api.use(['tinytest','test-helpers', 'random', 'mongo']);
  api.use('mikowals:batch-insert');
  api.addFiles('batch-insert-tests.js');
});
