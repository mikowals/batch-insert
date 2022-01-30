import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Mongo } from 'meteor/mongo'
import { _ } from 'meteor/underscore'
import { EJSON } from 'meteor/ejson'
import { MongoID } from 'meteor/minimongo'
import { CollectionExtensions } from 'meteor/lai:collection-extensions'

const Decimal = Package['mongo-decimal']?.Decimal || class DecimalStub {} // eslint-disable-line no-undef

let _batchInsert
if (Meteor.isServer) {
  ({ _batchInsert } = require('./batch-insert-server.js'))
}

Mongo.Collection.prototype._defineBatchInsert = function () {
  const self = this

  // don't define a method for a null collection
  if (!self._name || !self._connection) return
  const m = {}

  m['/' + self._name + '/batchInsert'] = function (docs) {
    check(docs, [Object])
    // 'this' refers to method context
    if (this.isSimulation) {
      return docs.map(function (doc) {
        if (!doc._id) { doc._id = self._makeNewID() }
        return self.insert(doc)
      })
    }

    // client returned so server code below
    const userId = this.userId
    const generatedIds = docs.map(function (doc) {
      if (!_.has(doc, '_id')) {
        return self._makeNewID()
      } else { return doc._id }
    })

    docs.forEach(function (doc, ii) {
      if (this.connection) {
        // server method called by client so check allow / deny rules.
        if (!((doc && _type(doc)) &&
              !EJSON._isCustomType(doc))) {
          throw new Error('Invalid modifier. Modifier must be an object.')
        }
        // call user validators.
        // Any deny returns true means denied.
        if (_.any(self._validators.insert.deny, function (validator) {
          return validator(userId, docToValidate(validator, doc, generatedIds[ii]))
        })) {
          throw new Meteor.Error(403, 'Access denied')
        }
        // Any allow returns true means proceed. Throw error if they all fail.
        if (_.all(self._validators.insert.allow, function (validator) {
          return !validator(userId, docToValidate(validator, doc, generatedIds[ii]))
        })) {
          throw new Meteor.Error(403, 'Access denied')
        }
      }

      doc._id = generatedIds[ii]
    }, this) // pass context of method into forEach
    return _batchInsert(self, docs)
    // end of method definition
  }

  self._connection.methods(m)
}

Mongo.Collection.prototype.batchInsert = function (/* args */) {
  const self = this

  const args = _.toArray(arguments)
  let cb
  if (typeof args[args.length - 1] === 'function') {
    cb = args.pop()
  }

  if (!self._name || !self._connection) {
    let res, err
    try {
      res = args[0].map(function (doc) {
        return self._collection.insert(doc)
      })
    } catch (e) {
      if (!cb) { throw e }
      err = e
    };
    cb && cb(err, res)

    return res
  } else if (self._connection && self._connection === Meteor.server) {
    const docs = args[0].map(function (doc) {
      if (!doc._id) doc._id = self._makeNewID()
      return doc
    })
    return _batchInsert(self, docs, cb)
  }
  if (cb) { return self._connection.apply('/' + self._name + '/batchInsert', args, { returnStubValue: true }, cb) }

  return self._connection.apply('/' + self._name + '/batchInsert', args, { returnStubValue: true })
}

CollectionExtensions.addExtension(function (name, options) {
  this._defineBatchInsert()
})

Meteor.Collection = Mongo.Collection

// function copied from MDG Mongo.Collection._validateInsert.  Needed in allow / deny checks.

function docToValidate (validator, doc, generatedId) {
  let ret = doc
  if (validator.transform) {
    ret = EJSON.clone(doc)
    // If you set a server-side transform on your collection, then you don't get
    // to tell the difference between "client specified the ID" and "server
    // generated the ID", because transforms expect to get _id.  If you want to
    // do that check, you can do it with a specific
    // `C.allow({insert: f, transform: null})` validator.
    if (generatedId !== null) {
      ret._id = generatedId
    }
    ret = validator.transform(ret)
  }
  return ret
};

function _type (v) {
  if (typeof v === 'number') { return 1 }
  if (typeof v === 'string') { return 2 }
  if (typeof v === 'boolean') { return 8 }
  if (_.isArray(v)) { return 4 }
  if (v === null) { return 10 }
  if (v instanceof RegExp) { return 11 } // note that typeof(/x/) === "object"
  if (typeof v === 'function') { return 13 }
  if (v instanceof Date) { return 9 }
  if (EJSON.isBinary(v)) { return 5 }
  if (v instanceof MongoID._ObjectID) { return 7 }
  if (v instanceof Decimal) { return 1 }
  return 3 // object

  // XXX support some/all of these:
  // 14, symbol
  // 15, javascript code with scope
  // 16, 18: 32-bit/64-bit integer
  // 17, timestamp
  // 255, minkey
  // 127, maxkey
};
