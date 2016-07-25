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
var RpcSync = require('./RpcSync');

var FileSync = function(opts, db){}

FileSync.prototype.prepareToSync = function(opts, next) {
  var self = this;
  console.log('prepareToSync');

  self.status = 'starting';
  self.startBlock = self.genesis;

  self.currentRpcHash = self.startBlock;
  
  self.status = 'syncing';
  return next();
};

FileSync.prototype.start = function(opts, next) {
  
}

module.exports = FileSync;