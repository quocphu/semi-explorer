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
var Block = require('./file/block.js');
var TxParser = require('./file/txparser.js');
var fs = require('fs');
var path = require('path');
var RpcSync = require('./RpcSync');
var AddressStore = require('./AddressStore');


var FileSync = function(opts, db){
  this.db = db;
};

FileSync.prototype.prepareToSync = function(opts, next) {
  var self = this;
  console.log('prepareToSync');

  self.status = 'starting'; 
  self.status = 'syncing';
  self.startFile = 0;
  self.endFile = 0;
  self.currentFile = self.startFile;
  self.addressStore = new AddressStore();
  return next();
};

FileSync.prototype.start = function(opts, next) {
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
        return self.status === 'syncing' && self.endFile >= self.currentFile;
      },
      function(w_cb) {
        var start = new Date().getTime();
        // Get block from file
        self.syncFile(self.currentFile, function(err){
          if (err) {
            return w_cb(self.setError(err));
          }
          self.currentFile ++;
          console.log('Finish: ', self.currentFile);
          var time = start - new Date().getTime();
          console.log(time/1000);
          w_cb();
        });
      }, next);
  });
};

FileSync.prototype.syncFile = function(fileNumber, cb){
    var fileName = 'blk' + ('0000' + fileNumber).slice(-5) + '.dat';
    var data = fs.readFileSync(path.join(config.bitcoind.dataDir + fileName));
    var reader = bufferReader(data);
    var blockRaw = readBockRaw(reader);
    var self = this;

    async.whilst(
      function(){return blockRaw != null && blockRaw.length > 80},
      function(cbFile){
        self.storeTipBlock(blockRaw, false, function(err){
          blockRaw = readBockRaw(reader);
          cbFile(err);
        })
      },
      function(err){
        console.log('end file: ', fileName);
        cb(err);
      }
    );
  };

  FileSync.prototype.storeTipBlock = function(blockRaw, allowReorgs, cb) {
    var start = new Date().getTime();
    var self = this;
    var txList = [];
    async.series([
        // Save tx, block
        function(sCb){
          var tmpBlock = new Block.fromBuffer(blockRaw);
          var block = tmpBlock.getHeader(config.coin.hashBlock);
          var txCount = tmpBlock.transactions.length;
          var i = 0;

          block.tx = [];
          block.height = -1;

          async.whilst(
            function(){return i < txCount},
            function(cbTx){
              async.setImmediate(function(){
                var parsedTx = TxParser.parse(tmpBlock.transactions[i], config.coin);
                parsedTx.blockhash = block.hash;
                parsedTx.blocktime = block.timestamp;
                parsedTx.time = block.timestamp;

                block.tx.push(parsedTx.txid);
                // console.log(util.inspect(parsedTx, {showHidden: false, depth: null}));
                txList.push(parsedTx);

                async.parallel([
                    // Insert vout
                    function(callback){
                      self.addressStore.storeAddressVout(parsedTx, self.db, function(err, rs){
                        return callback(err);
                      });
                    },
                    // Insert vin
                    function(callback){
                      self.addressStore.storeAddressVin(parsedTx, self.db, function(err){
                        return callback(err);
                      });
                    }
                ], function(pErr, results) {
                    if(pErr){
                      return cbTx(pErr);
                    }

                    if(txList.length >= 100){
                      TransactionDb.insert(txList, self.db, function(err){
                        if(err) {
                          return cbTx(err);
                        }});
                        txList = [];
                        i++;
                        cbTx();
                    } else {
                       i++;
                       cbTx();
                    }
                });
              });
            },
            function (err){
              if(err){
                return sCb(err);
              }
              if(txList.length){
                  TransactionDb.insert(txList, self.db, function(err){
                  if(err) {
                    return cbTx(err);
                  }});
                  txList = [];
              }

              // Save block
              BlockDb.insert([block], self.db, function(insertBlockErr){
                if(insertBlockErr){
                  return sCb(insertBlockErr);
                }
                self.addressStore.pushAll(self.db, function(pushError, count){
                  console.log('blockhash: ', block.hash, txCount,"\t", (new Date().getTime() - start)/1000);
                  return sCb(pushError);
                });
              });
                // return sCb();
            }
          );
        }
        // function(){},
        // function(){}
      ],
      function(err){
        return cb(err);
      }
    );
  };

function readVarInt(stream) {
    var size = stream.read(1);
    var sizeInt = size.readUInt8();
    if (sizeInt < 253) {
        return size;
    }
    var add;
    if (sizeInt == 253) {add = 2;}
    if (sizeInt == 254) {add = 4;}
    if (sizeInt == 255) {add = 8;}
    if (add) {
        return Buffer.concat([size, stream.read(add)], 1 + add);
    }
    return -1;
}

function toInt(varInt) {
    if (!varInt) {
        return -1;
    }
    if (varInt[0] < 253){ return varInt.readUInt8();}
    switch(varInt[0]) {
        case 253: return varInt.readUIntLE(1, 2);
        case 254: return varInt.readUIntLE(1, 4);
        case 255: return varInt.readUIntLE(1, 8);
    }
}

function getRawTx(reader) {
      var txParts = [];
      txParts.push(reader.read(4));// Version

      // Inputs
      var inputCount = readVarInt(reader);
      txParts.push(inputCount);
      for(var i = toInt(inputCount) - 1;i >= 0;i--) {
        txParts.push(reader.read(32));// Previous tx
        txParts.push(reader.read(4));// Index
        var scriptLength = readVarInt(reader);
        txParts.push(scriptLength);
        txParts.push(reader.read(toInt(scriptLength)));// Script Sig
        txParts.push(reader.read(4));// Sequence Number
      }

      // Outputs
      var outputCount = readVarInt(reader);
      txParts.push(outputCount);
      for(i = toInt(outputCount) - 1;i >= 0;i--) {
        txParts.push(reader.read(8));// Value
        var scriptLen = readVarInt(reader);
        txParts.push(scriptLen);
        txParts.push(reader.read(toInt(scriptLen)));// ScriptPubKey
      }
      txParts.push(reader.read(4));// Lock time

      return Buffer.concat(txParts);
    }

function bufferReader(buffer) {
    var index = 0;
    return {
        read: function read(bytes) {
            if (index + bytes > buffer.length) {
                return null;
            }
            var result = buffer.slice(index, index + bytes);
            index += bytes;
            return result;
        },
        readUInt32LE: function readUInt32LE() {
            var result = buffer.readUInt32LE(index);
            index += 4;

            return result;
          },
        index: function(){return index;}
    };
}

function readHeader(reader) {
    var version = reader.read(4);
    if (version == null) {
      return null;
    }
    if(version.toString('hex') == '00000000'){
        while(version.toString('hex') == '00000000'){
            version = reader.read(4);
            if(version == null){
                return null;
            }
            
        }
    } else if (version.toString('hex') == 'f9beb4d9') {
      // It's actually the magic number of a different block (previous one was
      // empty)
      reader.read(4);// block size
      return readHeader(reader);
    }
   
    var header = reader.read(76);
    if(header == null){
        return null;
    }
//return reader.read(76);//previous hash + merkle hash + time + bits + nonce
    return Buffer.concat([version, header]);
  }
function readBockRaw(reader) {
    var magic = reader.read(4);

    if (magic === null){
        return null;
    }
    
    if(magic.toString('hex') == '00000000'){
        while(magic.toString('hex') == '00000000'){
            version = reader.read(4);
            if(version == null){
                return null;
            }
        }
    }
    var size = reader.readUInt32LE();
    return reader.read(size);
  }

module.exports = FileSync;