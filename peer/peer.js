var bitcore = require('bitcore-lib');

var Peer = require('bitcore-p2p').Peer;
var Messages = require('bitcore-p2p').Messages;
var Inventory = require('bitcore-p2p').Inventory;
delete global._bitcore;

// var bitcore = global._bitcore;
// var bitcore = require('bitcore-lib');
var Networks = bitcore.Networks;
var Transaction = bitcore.Transaction;
var Script = bitcore.Script;
var BufferUtil = bitcore.util.buffer;
var async = require('async');
var util = require('util');

var TxParser = require('./TxParser.js');
var CONST = require('./constant.js');

var customNetworks = require('./networks.js');
var genesisBlockHash = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
var firstBlockHash = '0000000000000000000000000000000000000000000000000000000000000000';
var LinkedList = require('./LinkedList.js');
var logger = require('./logger.js');

var BlockDb = require('../lib/BlockDb.js');

/**
 * socket The socket io instant
 * opts {
 *  host: bitcoin fullnode address
 *  port: bitcoin fullnode port
 *  apiUrl: Insight url to get balance of multi address
 *  satoshiRate: satoshiRate,
 *  isConvertUnit: isConvertUnit,
 *  isEmitNewBlock: isEmitNewBlock
 * }
 */
var PeerConnection = function (socket, opts) {
  this.btcPeerOpts = {
    host: opts.host,
    port: opts.port || 8333
  };

  this.isProcessingBlock = false;
  this.currentBlock;
  this.latestRequest = '';
  this.count = 0;

  this.socket = socket;
  this.peer = new Peer(this.btcPeerOpts);
  this.db = opts.db;

  this.pool = new LinkedList();
  var self = this;
  // Handle events
  this.peer.on(CONST.socket.room.inv, function (message) {
    self._handleInv(message);
  });


  // Handle new tx 
  this.peer.on(CONST.socket.room.tx, function (message) {
    handleNewTx(message);
  });


  // Handle new block
  this.peer.on(CONST.socket.room.block, function (message) {
    // handleBlock(message, self.socket, opts);
    self._handleNewBlock(message);
    
  });
  
  this.latestTime = 10;

  this.peer.on('ready', function () {
    var hash = '0000000000000000031df6c1bdaae3652c452382fcab15a8ee73f7215e812bbf';
    var orphanedHash = '0000000000000000008966f4bfae08ca03eb7c5914a52efcb3fcd806ed5e8f0a';
    // var messages = new Messages();
    // var message = messages.GetData.forBlock(hash);
    // peer.sendMessage(message);
    self.latestRequest = self.pool.firstElement
    var message = new Messages().GetBlocks({starts: [
      self.latestRequest
    ]});
    
    self.peer.sendMessage(message);
    logger.info('BTC peer connected.')
    logger.info(self.peer.version, self.peer.subversion, self.peer.bestHeight);

    setInterval(function () {
      logger.info('Check latestTime');
      if (self.latestTime > 0 && !self.isProcessingBlock && new Date().getTime() - self.latestTime > 1000 * 10) {
        logger.info('Check latestTime send message again');
        var message = new Messages().GetBlocks({
          starts: [
            self.latestHash
          ]
        });
        self.latestTime = new Date().getTime();
        self.peer.sendMessage(message);
      }
    }, 10 * 1000);
  });

  this.peer.on('disconnect', function() {
    logger.info('peer connection closed');
  });
}

PeerConnection.prototype.start = function(){
  var self = this;
  this._init(function(err){
    if(err) {
      logger.error(err);
      return;
    }
    self.peer.connect();
  });
  
}

function handleNewTx(){}

PeerConnection.prototype._handleNewBlock = function(message){
  var self  = this;
  
  var blockHeader = message.block.header.toObject();
  // console.log('blockHeader:', blockHeader);

  // Check block hash is in pool
  var poolNode = self.pool.get(blockHeader.hash);
  console.log('_handleNewBlock: ', blockHeader.hash);
  if(!poolNode) {
    logger.debug('Not in pool: ', blockHeader.hash);
    return;
  }

  // Check block was added to pool before
  if(poolNode.block) {
    logger.debug('poolNode has data: ', poolNode.block.header.hash);
    return;
  }

  // Check prevHash of block is in pool
  if(!self.pool.get(blockHeader.prevHash) || (!self.pool.get(blockHeader.prevHash).block && blockHeader.prevHash!= genesisBlockHash)) {
    logger.debug('blockHeader.prevHash does not exist in pool: ', blockHeader.prevHash);
    return;
  }

  // Update new block data to pool
  self.pool.update(blockHeader.hash, {
    prev: blockHeader.prevHash,
    block: message.block
  });

  console.log(self.pool.get(blockHeader.prevHash));

  // Is Processing other block 
  if(self.isProcessingBlock) {
    console.log('isProcessingBlock: ', self.currentBlock.hash);
    return;
  }

  self.isProcessingBlock = true;
  self.currentBlock = blockHeader;

  var orphanBlocks = [];
  var foundInBestchain = false;
  var nextHash = '';
  var latestHash = '';
  var latestTime = 0;
  async.whilst(
    function () {
      return !!self.currentBlock ;
    },
    function (wCb) {
      nextHash = '';
      latestHash = '';
      async.series([
        function (sCb) {
          logger.debug('Process block: ', self.currentBlock.hash, self.count++, self.pool.getLength());
          var chainInfo = self.pool.getLongestChain(self.pool.getFirstKey());
          // console.log('chainInfo ', chainInfo, self.pool.getFirstKey());
          var bestChain = chainInfo.path;
          var orphan = chainInfo.orphan;
          orphanBlocks = [];

          // Remove orphan block
          for(var i =0; i < orphan.length; i++) {
            orphanBlocks = orphanBlocks.concat(self.pool.remove(orphan[i], true));
          }

          foundInBestchain = false;
          latestHash = bestChain[bestChain.length - 1];
          for(var i = 0; i < bestChain.length; i++) {
            if(bestChain[i] == self.currentBlock.hash) {
              foundInBestchain = true;
              nextHash = i < bestChain.length - 1 ? bestChain[i +1 ]: self.currentBlock.hash;
              break;
            }
          }

          sCb();
        },
        // TODO: Remove orphan block in db
        function (sCb) {
          if (orphanBlocks) {
            logger.debug('Remove all orphan blocks in db');
            orphanBlocks= [];
          }
          sCb();
        },
        // TODO: insert block to db
        function(sCb){
          if(foundInBestchain) {
            logger.info('Insert block to db: ', self.currentBlock.hash, self.pool.get(self.currentBlock.hash).blockHeight);
            var block = new bitcore.Block(self.pool.get(self.currentBlock.hash).block);
            console.log(block.transactions[0]);
          }
          sCb();
        },
        // Find next block
        function(sCb){
          // logger.debug('Find next block')
          var nextBlock = self.pool.get(nextHash);
          if(!nextBlock.block) {
            logger.info('Waiting block data: ', nextHash);
            self.currentBlock = null;
            return sCb();
          }
          
          // console.log('nextBlock:', nextBlock);
          // self.currentBlock = !nextBlock ? nextBlock: nextBlock.block;
          // console.log('nextHash ', nextHash);
          // console.log('latestHash ', latestHash);
          // // console.log('self.currentBlock.hash: ', self.currentBlock.hash);
          // // Send message get block hash
          if(self.currentBlock.hash == latestHash ) {
            logger.info('Send message get block hash after: ', latestHash);
            var message = new Messages().GetBlocks({
              starts: [
                latestHash
              ]
            });

            self.peer.sendMessage(message);
            self.currentBlock = null;
            while(self.pool.getLength() > 6) {
              self.pool.remove(self.pool.getFirstKey());
            }
            self.latestTime = new Date().getTime();
            self.latestHash = latestHash;
            return sCb();
          }
          self.currentBlock = nextBlock.block;
          sCb();
        }
      ], function (err) {
        if (err) {
          return logger.error(err);
        }
        if(!foundInBestchain) {
          return wCb('NOT_FOUND_BLOCK_IN_BEST_CHAIN');  
        }
        wCb();
      });
    },
    function (err) {
      logger.info('End whilst: ', err)
      self.isProcessingBlock = false;
    });
}

PeerConnection.prototype._handleInv = function(message){
    // Blocks
    (function(message, self){
      // console.log('inv: ', BufferUtil.reverse(message.inventory[0].hash).toString('hex'));
      if (message.inventory[0].type == 2) {
        // Create add to pool
        // Limit 6 blocks
        var LIMIT = 6;
        var limit = message.inventory.length < LIMIT ? message.inventory.length : LIMIT;

        for (var i = 0; i < limit; i++) {
          var node = {
            key: BufferUtil.reverse(message.inventory[i].hash).toString('hex'),
            value: {
              prev: i > 0 ? BufferUtil.reverse(message.inventory[i - 1].hash).toString('hex') : ''
            }
          };
          self.pool.add(node);
        }

        // Send get block data message
        for (var i = 0; i < limit; i++) {
          var msg = new Messages().GetData.forBlock(BufferUtil.reverse(message.inventory[i].hash).toString('hex'));
          self.peer.sendMessage(msg);
        }
      }
    })(message, this);
}

PeerConnection.prototype._init = function(cb){
  // Initialize pool
  // Get all block from db
  var genesisBlock = {
    key: genesisBlockHash,
    value : {
      prev: '',
      blockHeight: 0
    }
  }
  this.pool.add(genesisBlock);
  cb();
}
module.exports = {
  PeerConnection: PeerConnection
}

// var ltcNetwork = {
//   name: 'litecoin',
//   alias: 'litecoin',
//   pubkeyhash: 0x30,
//   privatekey: 0x80,
//   scripthash: 0x05,
//   xpubkey: 0x019da462,
//   xprivkey: 0x019d9cfe, //0x0488ade4,
//   networkMagic: 0xfbc0b6db,
//   port: 9333,
//   dnsSeeds: [
//   ]
// }
// var dashNetwork = {
//   name: 'dash',
//   alias: 'dash',
//   pubkeyhash: 0x4C,
//   privatekey: 0xCC,
//   scripthash: 0x10,
//   xpubkey: 0x02fe52f8,
//   xprivkey: 0x02fe52cc,
//   networkMagic: 0xbf0c6bbd,
//   port: 9999,
//   dnsSeeds: [
//   ]
// }
// console.log(Networks);
// Networks.add(ltcNetwork);
// Networks.add(dashNetwork);

// var ltcMessageOpt = {
//   network: Networks.get('litecoin'),
//   Block: bitcore.Block,
//   Transaction: bitcore.Transaction,
//   protocolVersion: 70003
// }

// var dashMessageOpt = {
//   network: Networks.get('dash'),
//   Block: bitcore.Block,
//   Transaction: bitcore.Transaction,
//   protocolVersion: 70076
// }
// var ltcPeerOptions = {
//   messages: new Messages(ltcMessageOpt),
//   host: '192.168.1.222',
//   port: 9333
// }

// var dashPeerOptions = {
//   messages: new Messages(dashMessageOpt),
//   host: '192.168.1.224',
//   port: 9999
// }