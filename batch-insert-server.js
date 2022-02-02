
import { Meteor } from 'meteor/meteor'
import { NpmModuleMongodb } from 'meteor/npm-mongo'
import { Random } from 'meteor/random'
import { Mongo, MongoInternals } from 'meteor/mongo'
import { _ } from 'meteor/underscore'
import { EJSON } from 'meteor/ejson'

const MongoDB = NpmModuleMongodb
const Future = Npm.require('fibers/future') // eslint-disable-line no-undef

// Need LocalCollection._ObjectID for type checking
const LocalCollection = {}
LocalCollection._ObjectID = function (hexString) {
  // random-based impl of Mongo ObjectID
  this.self._str = Random.hexString(24)
}

// This is used to add or remove EJSON from the beginning of everything nested
// inside an EJSON custom type. It should only be called on pure JSON!
const replaceNames = function (filter, thing) {
  if (typeof thing === 'object') {
    if (_.isArray(thing)) {
      return _.map(thing, _.bind(replaceNames, null, filter))
    }
    const ret = {}
    _.each(thing, function (value, key) {
      ret[filter(key)] = replaceNames(filter, value)
    })
    return ret
  }
  return thing
}

// Ensure that EJSON.clone keeps a Timestamp as a Timestamp (instead of just
// doing a structural clone).
// XXX how ok is this? what if there are multiple copies of MongoDB loaded?
MongoDB.Timestamp.prototype.clone = function () {
  // Timestamps should be immutable.
  return this
}

const makeMongoLegal = function (name) { return 'EJSON' + name }
const unmakeMongoLegal = function (name) { return name.substr(5) }

const replaceMongoAtomWithMeteor = function (document) {
  if (document instanceof MongoDB.Binary) {
    const buffer = document.value(true)
    return new Uint8Array(buffer)
  }
  if (document instanceof MongoDB.ObjectID) {
    return new Mongo.ObjectID(document.toHexString())
  }
  if (document.EJSON$type && document.EJSON$value &&
      _.size(document) === 2) {
    return EJSON.fromJSONValue(replaceNames(unmakeMongoLegal, document))
  }
  if (document instanceof MongoDB.Timestamp) {
    // For now, the Meteor representation of a Mongo timestamp type (not a date!
    // this is a weird internal thing used in the oplog!) is the same as the
    // Mongo representation. We need to do this explicitly or else we would do a
    // structural clone and lose the prototype.
    return document
  }
  return undefined
}

const replaceMeteorAtomWithMongo = function (document) {
  if (EJSON.isBinary(document)) {
    // This does more copies than we'd like, but is necessary because
    // MongoDB.BSON only looks like it takes a Uint8Array (and doesn't actually
    // serialize it correctly).
    return new MongoDB.Binary(Buffer.from(document))
  }
  if (document instanceof Mongo.ObjectID) {
    return new MongoDB.ObjectID(document.toHexString())
  }
  if (document instanceof MongoDB.Timestamp) {
    // For now, the Meteor representation of a Mongo timestamp type (not a date!
    // this is a weird internal thing used in the oplog!) is the same as the
    // Mongo representation. We need to do this explicitly or else we would do a
    // structural clone and lose the prototype.
    return document
  }
  if (EJSON._isCustomType(document)) {
    return replaceNames(makeMongoLegal, EJSON.toJSONValue(document))
  }
  // It is not ordinarily possible to stick dollar-sign keys into mongo
  // so we don't bother checking for things that need escaping at this time.
  return undefined
}

const replaceTypes = function (document, atomTransformer) {
  if (typeof document !== 'object' || document === null) { return document }

  const replacedTopLevelAtom = atomTransformer(document)
  if (replacedTopLevelAtom !== undefined) { return replacedTopLevelAtom }

  let ret = document
  _.each(document, function (val, key) {
    const valReplaced = replaceTypes(val, atomTransformer)
    if (val !== valReplaced) {
      // Lazy clone. Shallow copy.
      if (ret === document) { ret = _.clone(document) }
      ret[key] = valReplaced
    }
  })
  return ret
}

const getIdsFromMongoResult = function (res) {
  if (res?.ops) {
    const replacedOps = replaceTypes(res.ops, replaceMongoAtomWithMeteor)
    return _.pluck(replacedOps, '_id')
  }

  if (res?.insertedIds) {
    return Object.values(res.insertedIds)
  }

  throw new Error('getIdsFromMongoResult: unknown result type')
}

export const _batchInsert = function (collection, docs, cb) {
  const connection = MongoInternals.defaultRemoteCollectionDriver().mongo
  const write = connection._maybeBeginWrite()
  const _collection = collection.rawCollection()
  const future = new Future()
  _collection.insertMany(replaceTypes(docs, replaceMeteorAtomWithMongo), { safe: true }, future.resolver())
  try {
    let result = future.wait()
    result = getIdsFromMongoResult(result)
    docs.forEach(function (doc) {
      Meteor.refresh({ collection: collection._name, id: doc._id })
    })
    write.committed()
    if (cb) { return cb(null, result) }
    return result
  } catch (e) {
    write.committed()
    if (cb) { return cb(e) }
    throw (e)
  }
}
