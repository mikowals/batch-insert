Package.describe({
  summary: "Insert multiple documents to mongo collection with one db call.",
  version: "1.2.0",
  name: "mikowals:batch-insert",
  git: "https://github.com/mikowals/batch-insert.git"
});

Npm.strip({
  mongodb: ["test/"]
});

Package.onUse( function( api ) {
  api.versionsFrom('METEOR@1.10.2');
  api.use('npm-mongo', 'server');
  api.use(['mongo', 'ddp','ejson','underscore', 'check']);
  api.use('insecure', {weak: true});
  api.use('lai:collection-extensions@0.2.1_1');
  api.imply(['mongo', 'ddp']);
  api.addFiles('batch-insert-server.js','server');
  api.addFiles('batch-insert-common.js');
});

Package.onTest( function( api ) {
  api.use(['tinytest','test-helpers', 'random', 'mongo', 'accounts-base']);
  api.use('mikowals:batch-insert');
  api.mainModule('batch-insert-tests.js');
});
