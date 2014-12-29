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
      //colServer._defineBatchInsert();
    }
    //console.log( Meteor );
    console.log( 'finished' );
    return true;
  },
  testDefineBatchInsertDisallow: function( s ){
    if ( ! this.isSimulation ){
      var colServer2 = new Meteor.Collection( s );
      colServer2.allow({
        insert: function(){ return false;}
      });
      //colServer._defineBatchInsert();
    }
    //console.log( Meteor );
    console.log( 'finished' );
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
        test.equal( actualErr, expectedErr , 'insert should fail based on allow rule');
      }));
    }

  ]);
} else {
  //server tests
  Tinytest.add( 'mikowals:batch-insert - batch insert on server collection', function( test ){
    var serverCol = new Meteor.Collection(Random.secret( 10 ));
    serverCol.deny({
      insert: function(){ return false; }
    });
    var ids = serverCol.batchInsert([{_id: 'a', name: 'earl'}, {_id: 'b', name: 'brian'}]);
    test.equal( ids, ['a','b'], 'should return given ids' );
  });
}
