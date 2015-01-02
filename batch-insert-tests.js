// Write your tests here!
// Here is an example.
var col;
Meteor.methods({
  testDefineBatchInsert: function( s ){
    if ( ! this.isSimulation ){
      var colServer = new Meteor.Collection( s );
      colServer.allow({
        insert: function(){ return true;}
      });
    }
    return true;
  },
  testDefineBatchInsertDisallow: function( s ){
    if ( ! this.isSimulation ){
      var colServer2 = new Meteor.Collection( s );
      colServer2.allow({
        insert: function(){ return false;}
      });
    }
    return true;
  }
});

if (Meteor.isClient ){
  var colName = Random.secret( 10 );
  Meteor.apply( 'testDefineBatchInsert',[colName], {wait: true, returnStubValue: true});
  var col = new Meteor.Collection( colName );

  Tinytest.add( 'mikowals:batch-insert - client side insert', function( test ){
    var ids = col.batchInsert( [{_id: "1", name: 'phil'}, {_id: "2", name: 'sally'}] );
    test.equal(ids, ["1","2"], 'client side batchInsert');
  });


  testAsyncMulti( 'mikowals:batch-insert - server _ids match client and allow rules manage security', [
    function( test, expect ) {
      var ids = col.batchInsert( [{name:'john'}, {name: 'jerry'} ], expect( function( err, res ){
        test.equal( ids, res, 'server and client ids match');
        //test.equal( col.findOne( ids[0] ).name, 'john', 'able to retrieve new obj from db');
      }));
    },
    function( test, expect ){
      var testColName = Random.secret( 10 );
      Meteor.apply( 'testDefineBatchInsertDisallow',[testColName], {wait: true, returnStubValue: true});
      var testCol = new Meteor.Collection( testColName );
      testCol.batchInsert( [{name: Random.secret(5) }, {name: Random.secret(5)}], expect( function( err, res){
        var expectedErr = JSON.stringify( {error:403,reason:"Access denied",message:"Access denied [403]",errorType:"Meteor.Error"} );
        var actualErr = JSON.stringify( err );
        console.log(res);
        test.equal( err.reason, "Access denied" , 'insert should fail based on allow rule');
      }));
    }

  ]);
} else {
  //server only tests
  Tinytest.add( 'mikowals:batch-insert -  test error on duplicate id', function( test ){
    //this test is a problem.  Individual docs can be inserted while others fail.
    var newColName = Random.secret( 10 );
    var col = new Meteor.Collection( newColName );
    col.batchInsert( [{_id:1}, {_id:2}] );
    function insertAgain(){
      var err = col.batchInsert([ {_id:3, name: 'shouldFail'}, {_id:1} ]);
    }
    var msg = 'E11000 duplicate key error index: meteor.' + newColName + '.$_id_  dup key: { : 1 }';
    test.throws( insertAgain, msg, 'insert should fail with duplicate ids');
    test.equal( col.findOne( 3 ), undefined, 'all inserts should fail if one fails');
    test.equal( col.find({batch:{$ne: null}}).count(), 0, 'batch marker should be removed from all docs');
  }),

  Tinytest.add( 'mikowals:batch-insert - batch insert on server collection', function( test ){
    var serverCol = new Meteor.Collection(Random.secret( 10 ));
    serverCol.deny({
      insert: function(){ return false; }
    });
    var ids = serverCol.batchInsert([{_id: 'a', name: 'earl'}, {_id: 'b', name: 'brian'}]);
    test.equal( ids, ['a','b'], 'should return given ids' );
  });
}
