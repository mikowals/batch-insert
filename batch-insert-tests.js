// Write your tests here!
// Here is an example.
var col;
Meteor.methods({
  testDefineBatchInsert: function( s ){

    if ( ! this.isSimulation ){
      var colServer = new Meteor.Collection( s );

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

  testAsyncMulti( 'mikowals:batch-insert - server _ids match client', [
    function( test, expect ) {
      var ids = col.batchInsert( [{name:'john'}, {name: 'jerry'} ], expect( function( err, res ){
        test.equal( ids, res, 'server and client ids match');
        //test.equal( col.findOne( ids[0] ).name, 'john', 'able to retrieve new obj from db');
      }));
    }

  ]);
} else {
  Tinytest.add( 'mikowals:batch-insert - batch insert on server collection', function( test ){
    var serverCol = new Meteor.Collection(Random.secret( 10 ));
    var ids = serverCol.batchInsert([{_id: 'a', name: 'earl'}, {_id: 'b', name: 'brian'}]);
    test.equal( ids, ['a','b'], 'should return given ids' );
  });
}
