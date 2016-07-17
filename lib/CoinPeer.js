'use strict';
var fs          = require('fs');
var bitcore     = require('bitcore');
var bitcoreUtil = bitcore.util;
var Peer        = bitcore.Peer;
var PeerManager = bitcore.PeerManager;
var config      = require('../config/config');
var networks    = bitcore.networks;
var TxDb        = require('./TransactionDb');
var buffertools = require('buffertools');

function CoinPeer(opts) {
  opts = opts|| {};
  this.connected = false;
  this.peerdb = undefined;
  var pmConfig = {
    network: config.network
  };
  this.peerman = new PeerManager(pmConfig);
  this.load_peers();
  this.verbose = opts.verbose || false;
}

CoinPeer.prototype.log = function() {
  if (this.verbose) console.log(arguments);
};

CoinPeer.prototype.load_peers = function() {
  this.peerdb = [{
    ipv4: config.bitcoind.p2pHost,
    port: config.bitcoind.p2pPort
  }];
};

CoinPeer.prototype.info = function() {
  return {
    connected: this.connected,
    host: this.peerdb[0].ipv4,
    port: this.peerdb[0].port
  };
};

CoinPeer.prototype.handleInv = function(info) {
  var invs = info.message.invs;
  info.conn.sendGetData(invs);
  console.log('invs')
  // console.log(invs)
};


CoinPeer.prototype.handleTx = function(info) {
  var self =this;
  var tx = TxDb.getStandardizedTx(info.message.tx);
  tx.time = tx.time || Math.round(new Date().getTime() / 1000);    
  console.log('new tx:' + tx.txid);
  // console.log(tx)  
};

CoinPeer.prototype.handleBlock = function(info) {
  var self = this;
  var block = info.message.block;
  var blockHash = bitcoreUtil.formatHashFull(block.calcHash());

  console.log('new block: ' + blockHash)
  console.log(block)
};

CoinPeer.prototype.handleConnected = function(data) {
  var peerman = data.pm;
  var peers_n = peerman.peers.length;
  this.log('[p2p_sync] Connected to ' + peers_n + ' peer' + (peers_n !== 1 ? 's' : ''));

  // var conn = peerman.getActiveConnection();
  // var blocks = [];
  //   var hash1 = buffertools.reverse(new Buffer('1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691','hex'))
  //   var hash1 = buffertools.reverse(new Buffer('0055d5c5bcc2b42005559435872c00c54b43ee4906f0f6fe1b4d4547da78cddb','hex'))
  //   blocks.push(hash1);
    
  //   // blocks.push(new Buffer('1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691','hex').reverse());
    
  //   var stop = buffertools.reverse(new Buffer('b2a0e8289ae2947634afab0c620c7ba074768e3ddd3248142350965846ba17a6','hex'));
  //   console.log(stop)
  //   conn.sendGetBlocks(blocks, stop, false);
};

CoinPeer.prototype.run = function() {
  var self = this;

  this.peerdb.forEach(function(datum) {
    var peer = new Peer(datum.ipv4, datum.port);
    self.peerman.addPeer(peer);
  });

  this.peerman.on('connection', function(conn) {
    self.connected = true;
    conn.on('inv', self.handleInv.bind(self));
    conn.on('block', self.handleBlock.bind(self));
   // conn.on('tx', self.handleTx.bind(self));

  });

  this.peerman.on('connect', self.handleConnected.bind(self));

  this.peerman.on('netDisconnected', function() {
    self.connected = false;
  });

  this.peerman.start();
};

module.exports = require('soop')(CoinPeer);
