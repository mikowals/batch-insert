/* eslint-env mocha */
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { Mongo } from 'meteor/mongo'

import chai, { expect } from 'chai'
chai.use(require('chai-as-promised'))

Meteor.methods({
  testDefineBatchInsert: function (s) {
    if (!this.isSimulation) {
      const colServer = new Meteor.Collection(s)
      colServer.allow({
        insert: function () { return true }
      })
    }
    return true
  },
  testDefineBatchInsertDisallow: function (s) {
    if (!this.isSimulation) {
      const colServer2 = new Meteor.Collection(s)
      colServer2.allow({
        insert: function () { return false }
      })
    }
    return true
  },

  testDefineBatchInsertDeny: function (s) {
    if (!this.isSimulation) {
      const colServer2 = new Meteor.Collection(s)
      colServer2.allow({
        insert: function () { return true }
      })
      colServer2.deny({
        insert: function () { return true }
      })
    }
    return true
  }
})

describe('mikowals:batch-insert', function () {
  // common tests
  it('leaves collection as instance of Mongo.Collection', function () {
    const newColName = Random.secret(10)
    const col = new Meteor.Collection(newColName)
    expect(col instanceof Mongo.Collection).to.equal(true)
  })

  it('leaves Meteor.users an instance of (Mongo/Meteor).Collection', function () {
    expect(Meteor.users).to.be.instanceof(Mongo.Collection)
    expect(Meteor.users).to.be.instanceof(Meteor.Collection)
  })

  it('fails with duplicate ids', function () {
    const newColName = Random.secret(10)
    const col = new Meteor.Collection(newColName)
    col.batchInsert([{ _id: 1 }, { _id: 2 }])
    const callInsert = () => new Promise((resolve, reject) => {
      col.batchInsert([{ _id: 3, name: 'shouldFail' }, { _id: 1 }], (err, res) => {
        if (err) {
          reject(err)
        } else {
          resolve(res)
        }
      })
    })
    const msg = 'E11000 duplicate key error collection: meteor.' + newColName + ' index: _id_ dup key: { _id: 1 }'
    expect(callInsert()).to.be.rejectedWith(msg)
  })

  if (Meteor.isClient) {
    const colName = Random.secret(10)
    Meteor.apply('testDefineBatchInsert', [colName], { wait: true, returnStubValue: true })
    const col = new Meteor.Collection(colName)

    it('inserts multiple docs', function () {
      const ids = col.batchInsert([{ _id: '1', name: 'phil' }, { _id: '2', name: 'sally' }])
      expect(ids).to.deep.equal(['1', '2'])
      expect(col.find({ _id: { $in: ['1', '2'] } }).count()).to.equal(2)
    })

    it('returns client ids that match server ids', function () {
      let clientIds
      const testFn = () => new Promise((resolve, reject) => {
        clientIds = col.batchInsert([{ name: 'john' }, { name: 'jerry' }], (err, res) => {
          if (err) {
            reject(err)
          } else {
            resolve(res)
          }
        })
      })
      expect(testFn()).to.eventually.deep.equal(clientIds)
    })

    it('is is blocked from inserting without allow rule', function () {
      const testColName = Random.secret(10)
      Meteor.apply('testDefineBatchInsertDisallow', [testColName], { wait: true, returnStubValue: true })
      const testCol = new Meteor.Collection(testColName)
      const testFn = () => new Promise((resolve, reject) => {
        testCol.batchInsert([{ name: Random.secret(5) }, { name: Random.secret(5) }], (err, res) => {
          if (err) {
            reject(err)
          } else {
            resolve(res)
          }
        })
      })
      expect(testFn()).to.be.rejectedWith('Access denied')
    })

    it('is is blocked from inserting by deny rules', function () {
      const testColName = Random.secret(10)
      Meteor.apply('testDefineBatchInsertDeny', [testColName], { wait: true, returnStubValue: true })
      const testCol = new Meteor.Collection(testColName)
      const testFn = () => new Promise((resolve, reject) => {
        testCol.batchInsert([{ name: Random.secret(5) }, { name: Random.secret(5) }], (err, res) => {
          if (err) {
            reject(err)
          } else {
            resolve(res)
          }
        })
      })
      expect(testFn()).to.be.rejectedWith('Access denied')
    })
  } else {
    // server tests
    describe('mikowals:batch-insert', function () {
      it('ignores deny and inserts from server', function () {
        const serverCol = new Meteor.Collection(Random.secret(10))
        serverCol.deny({
          insert: function () { return true }
        })
        const ids = serverCol.batchInsert([{ _id: 'a', name: 'earl' }, { _id: 'b', name: 'brian' }])
        expect(ids).to.deep.equal(['a', 'b'])
      })

      it('calls callback with result', async function () {
        const serverCol = new Meteor.Collection(Random.secret(10))
        const result = await new Promise((resolve, reject) => {
          serverCol.batchInsert([{ _id: 'a', name: 'john' }, { _id: 'b', name: 'jerry' }], (err, res) => {
            if (err) {
              reject(err)
            } else {
              resolve(res)
            }
          })
        })
        expect(result).to.deep.equal(['a', 'b'])
      })
    })
  }
})
