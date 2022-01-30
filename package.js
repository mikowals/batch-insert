/* eslint-env meteor */
Package.describe({
  summary: 'Insert multiple documents to mongo collection with one db call.',
  version: '1.3.0',
  name: 'mikowals:batch-insert',
  git: 'https://github.com/mikowals/batch-insert.git'
})

Npm.strip({
  mongodb: ['test/']
})

Package.onUse = Package.onUse || Package.on_use // backwards-compat
Package.onTest = Package.onTest || Package.on_test // backwards-compat

Package.onUse(function (api) {
  api.addFiles = api.addFiles || api.add_files // backwards-compat

  api.versionsFrom('METEOR@1.10.2')

  api.use('npm-mongo@3.7.0 || 4.3.1-rc260.1', 'server')
  api.use(['ecmascript', 'mongo', 'ddp', 'ejson', 'underscore', 'check', 'lai:collection-extensions'])
  api.use('insecure', { weak: true })
  api.imply(['mongo', 'ddp'])
  api.addFiles('batch-insert-server.js', 'server')
  api.addFiles('batch-insert-common.js')
})

Package.onTest(function (api) {
  api.use([
    'ecmascript',
    'meteortesting:mocha',
    'random',
    'mongo',
    'accounts-base',
    'autopublish',
    'mikowals:batch-insert'
  ])
  api.addFiles('tests/batch-insert.test.js')
})
