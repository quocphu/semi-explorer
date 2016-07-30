var bitcore     = require('bitcore');
var bitcoreUtil = bitcore.util;
var buffertools = require('buffertools');
var Script = bitcore.Script;
var base58 = require('base58-native').base58Check;

var FileSync = require('./lib/FileSync.js');



var pg = require('pg');


var conString = "postgres://postgres:1@localhost/btc";

pg.connect(conString, function(err, client, done) {
  if(err) {
    console.error('error fetching client from pool', err);
    return done();
  }
  var startTime = new Date().getTime();  
  var start = new Date().getTime();

  var f = new FileSync(null, client);

  f.start(null, function(err){
    
      var end = new Date().getTime();
      console.log((end - start)/1000);
    
  });


});