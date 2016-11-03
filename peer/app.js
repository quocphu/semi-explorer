var Peer = require('./peer.js');




var pg = require('pg');

var types = require('pg').types;
var timestampOID = 1114;
types.setTypeParser(1114, function(stringValue) {
  return stringValue;
})

var conString = "postgres://postgres:1@localhost/semi-btc";

pg.connect(conString, function(err, client, done) {
  if(err) {
    console.error('error fetching client from pool', err);
    return done();
  }
  var startTime = new Date().getTime();
  
  var opts = {
    host: '192.168.1.211',
    // host: '192.168.1.221',
    port:  8333,
    db: client
}

  var bitcoinPeer = new Peer.PeerConnection({}, opts);
  bitcoinPeer.start();

});

