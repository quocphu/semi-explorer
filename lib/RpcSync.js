'use strict';

var imports = require('soop').imports();
var util = require('util');
var async = require('async');

var bitcore = require('bitcore');
var networks = bitcore.networks;
var config = imports.config || require('../config/config');
var buffertools = require('buffertools');
var bitcoreUtil = bitcore.util;
var logger = require('./logger').logger;
var info = logger.info;
var error = logger.error;
var BlockDb = require('./BlockDb');
var TransactionDb = require('./TransactionDb');
var AddressDb = require('./AddressDb');
var Rpc = require('./Rpc');
var PERCENTAGE_TO_START_FROM_RPC = 0.96;

var RpcSync = function(opts, db){
  opts = opts || {};
  this.shouldBroadcast = opts.shouldBroadcastSync;

  this.network = config.network === 'testnet' ? networks.testnet : networks.livenet;

  var genesisHashReversed = new Buffer(32);
  this.network.genesisBlock.hash.copy(genesisHashReversed);
  buffertools.reverse(genesisHashReversed);
  this.genesis = '80ca095ed10b02e53d769eb6eaf92cd04e9e0759e5be4a8477b42911ba49c78f';
  // this.genesis = '5e29287a9bed513ba9a49f583179d014f11d7c67d906fcbeedab3759ff599562';
  this.genesis = '00000000000000000df5afcede52f6df05c5b6db16d0e486ed3cbec6f40e73be';

  var bitcore = require('bitcore');

  var RpcClient = bitcore.RpcClient;

  this.rpc = new RpcClient(config.bitcoind);

  // info('Bitcoin Core version ', bitcoinVersion);
  info('Using RPC sync ');

  this.height = 0;
  this.max = 343534;
  this.db = db;
};

RpcSync.prototype.prepareToSync = function(opts, next) {
  var self = this;
  console.log('prepareToSync');

  self.status = 'starting';
  self.startBlock = self.genesis;

  self.currentRpcHash = self.startBlock;
  
  self.status = 'syncing';
  return next();
};

RpcSync.prototype.start = function(opts, next) {
  var self = this;

  if (self.status === 'starting' || self.status === 'syncing') {
    error('## Wont start to sync while status is %s', self.status);
    return next();
  }

  self.prepareToSync(opts, function(err) {
    if (err) return next(self.setError(err));

    async.whilst(
      function() {
        // self.showProgress();
        return self.status === 'syncing' && self.max >= self.height;
      },
      function(w_cb) {
        // Get block from RPC
        self.getBlockFromRPC(function(err, blockInfo) {
          if (err) return w_cb(self.setError(err));

          if (blockInfo && blockInfo.hash) {
            console.log(blockInfo.hash + ':' + blockInfo.height)
            // Insert block to database
            self.storeTipBlock(blockInfo, self.allowReorgs, function(err, height) {
              // Temporary
              self.height = blockInfo.height;

              if (err) return w_cb(self.setError(err));
              if (height >= 0) self.height = height;
              setImmediate(function() {
                return w_cb(err);
              });
            });
          } else {
            self.endTs = Date.now();
            self.status = 'finished';
            var info = self.info();
            logger.debug('Done Syncing blockchain', info.type, 'to height', info.height);
            return w_cb(err);
          }
        });
      }, next);
  });
};


/*
  * Arrives a NEW block, which is the new TIP
  *
  * Case 0) Simple case
  *    A-B-C-D-E(TIP)-NEW
  *
  * Case 1)
  *    A-B-C-D-E(TIP)
  *        \
  *         NEW
  *
  *  1) Declare D-E orphans (and possible invalidate TXs on them)
  *
  * Case 2)
  *    A-B-C-D-E(TIP)
  *        \
  *         F-G-NEW
  *  1) Set F-G as connected (mark TXs as valid)
  *  2) Set new heights  in F-G-NEW 
  *  3) Declare D-E orphans (and possible invalidate TXs on them)
  *
  *
  * Case 3)
  *
  *    A-B-C-D-E(TIP) ...  NEW
  *
  *    NEW is ignored (if allowReorgs is false)
  *
  *
  */
RpcSync.prototype.storeTipBlock = function(b, allowReorgs, cb) {
  if (!b) return cb();
  var self = this;

  if ( self.storingBlock ) {
    logger.debug('Storing a block already. Delaying storeTipBlock with:' + b.hash);
    return setTimeout( function() {
      logger.debug('Retrying storeTipBlock with: ' + b.hash);
      self.storeTipBlock(b, allowReorgs, cb);
    }, 1000);
  }

  self.storingBlock = 1;
  var orphanBlockFrom = null;
  async.series([
    // function(c){
    //   Static.getLastBlock(function(err, lBlock){
    //     if(err) {
    //       return c(err);
    //     }

    //     if(!lBlock || b.previousblockhash == lBlock.hash){
    //       return c();
    //     }

    //     BlockDb.getBlock(b.previousblockhash, function(err, block){
    //       if(err) {
    //         return c(err);
    //       }
          
    //       // Case 1
    //       if(block){
    //         orphanBlockFrom = block.hash;
    //         return c();
    //       }
    //       // Case 2
    //       traceToOrphanBlock(function(err, hash, nextHashes){
    //         orphanBlockFrom = from;
    //         nextOrphanHashes = nextHashes;
    //         return c();
    //       });
    //     });

    //   });
    // },
    // // Process case 1
    // function(c){
    //   if(nextOrphanHashes){
    //     return c();
    //   }
    // },
    // // Process case 2
    // function(c){
    //   if(!nextOrphanHashes){
    //     return c();
    //   }
    // },
    // Save block
    function(c){
      BlockDb.insert([b], self.db, function(err){
        // console.log('insert block done')
        return c(err);
      })
    },
    // Save transaction
    function(c){
      async.eachSeries(b.tx, function(txid, end){
        Rpc.getTxInfo(txid, function(err, tx) {
          if (!tx) {
            return end(err);
          }
          TransactionDb.insert([tx], self.db, function(err){
            if(err) {
              return end(err);
            }

            // Insert vout
            RpcSync.storeAddressVout(tx, self.db, function(err, rs){
              if(err) {
                return end(err, rs);
              }
              // Insert vin
              RpcSync.storeAddressVin(tx, self.db, function(err){
                if(err){
                  return end(err);
                }
                return end();
              });
            });
          });
        });
      }, function end(err){
        return c(err);
      });
    }
    ], function(err){
      // console.log('ENDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD');
      // console.log(err);
      if(err){
        console.log(err)
      }
      if (err && err.toString().match(/WARN/)) {
          err = null;
      }
      self.storingBlock=0;
      return cb(err, b.height);
  });
}

RpcSync.storeAddressVout = function(tx, db, cb){
  var addresses = [];
  for(var i = 0; i < tx.vout.length; i++){
    var related = [];
    var voutAddress = tx.vout[i].scriptPubKey.addresses || [];
    for(var j = 0; j < voutAddress.length; j++){
      var item = {
        address: voutAddress[j],
        related: voutAddress.join(',').replace(voutAddress[j] + ",", '').replace(voutAddress[j], ''),
        txid: tx.txid,
        amount: tx.vout[i].value,
        n: tx.vout[i].n,
        ts: tx.time
      };
      addresses.push(item);
    }
  }
  AddressDb.insertVout(addresses, db, cb);
}

RpcSync.storeAddressVin = function (tx, db, cb){
  var addresses = [];
  async.eachSeries(tx.vin, function(vin, end){
    if(vin.coinbase){
      return end();
    }

    TransactionDb.getVout(vin.txid, vin.vout, db, function(err, vout){
      if(err) {
        return end(err);
      }

      if(vout){
        var voutAddress = vout.addresses || [];
        for(var j = 0; j < voutAddress.length; j++){
         var item = {
            address: voutAddress[i],
            related: voutAddress.join(',').replace(voutAddress[j] + ",", '').replace(voutAddress[j], ''),
            txid: tx.txid,
            amount: vout.value,
            n: vout.n,
            ts: tx.time
          };
          addresses.push(item);
        }
        
        return end();
      } 
      // return end('CAN NOT FIND TXID: ', vin.txid);
      return end();
    });
  }, function end(err){
    if(err){
      return cb(err);
    }
    if(addresses.length > 0){
      AddressDb.insertVin(addresses, db, function(err){
        return cb(err);
      });
    } else {
      return cb();  
    }
  });
  
}


RpcSync.prototype.getBlockFromRPC = function(cb) {
  var self = this;

  if (!self.currentRpcHash) return cb();

  var blockInfo;
  self.rpc.getBlock(self.currentRpcHash, function(err, ret) {
    if (err) return cb(err);
    if (ret) {
      blockInfo = ret.result;
      // this is to match block retreived from file
      if (blockInfo.hash === self.genesis)
        blockInfo.previousblockhash =
        self.network.genesisBlock.prev_hash.toString('hex');

      self.currentRpcHash = blockInfo.nextblockhash;
    } else {
      blockInfo = null;
    }
    return cb(null, blockInfo);
  });
};

RpcSync.prototype.setError = function(err) {
  var self = this;
  self.error = err.message ? err.message : err.toString();
  self.status = 'error';
  self.showProgress();
  return err;
};

RpcSync.prototype.showProgress = function() {
  var self = this;

  if (self.status === 'syncing' &&
    (self.height) % self.step !== 1) return;

  if (self.error)
    error(self.error);

};

module.exports = RpcSync;
