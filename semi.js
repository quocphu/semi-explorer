var fs = require('fs');

var RpcSync = require('./lib/RpcSync');

var http = require('http');
var https = require('https');
var express = require('express');


var config = require('./config/config');
var logger = require('./lib/logger').logger;

var pg = require('pg');


var conString = "postgres://postgres:1@localhost/litecoin";

pg.connect(conString, function(err, client, done) {
  if(err) {
    console.error('error fetching client from pool', err);
    return done();
  }
  var startTime = new Date().getTime();
  var rpcSync = new RpcSync(null, client);
  rpcSync.start();


});