var bitcore     = require('bitcore');
var bitcoreUtil = bitcore.util;
var buffertools = require('buffertools');
var Script = bitcore.Script;
var base58 = require('base58-native').base58Check;
var config = require('../config/config');

var encodedData = require('soop').load('bitcore/util/EncodedData', {
  base58: base58
});
var versionedData = require('soop').load('bitcore/util/VersionedData', {
  parent: encodedData
});

var Address = require('soop').load('bitcore/lib/Address', {
  parent: versionedData
});

var TransactionDb = function(){};

function insert(txs, db, cb){
  var table = 'Txes';
  var iTxQ = '';
  iTxQ += "insert into " + table + "(txid, blockhash, data) values";
  for(var i = 0; i < txs.length; i++){
    tx = txs[i];
    iTxQ += "(";
    iTxQ += "'" + tx.txid + "',";
    iTxQ += "'" + tx.blockhash + "',";    
    iTxQ += "'" + JSON.stringify(tx) + "'";
    iTxQ += ")";
    if(i < txs.length - 1){
      iTxQ += ",";
    }
  }
  iTxQ += ";"; 
  
  db.query(iTxQ, function(err, result){
    return cb(err, result);
  });
}

function getVout(txid, n, db, cb){
  var sql = "select data::json#>'{vout," + n + "}' as vout from txes where txid = '"+txid+"'";
  
  db.query(sql, function(err, result){
    if(err){
      return cb(err);
    }

    if(result.rows.length > 0){
      return cb(null, result.rows[0].vout);
    }    
    return cb(null, null);
  });
}

function _fromBuffer(buf) {
  var buf2 = buffertools.reverse(buf);
  return parseInt(buf2.toString('hex'), 16);
};

function getStandardizedTx(tx, time, isCoinBase) {
  var self = this;
  tx.txid = bitcoreUtil.formatHashFull(tx.getHash());
  var ti = 0;

  tx.vin = tx.ins.map(function(txin) {
    var ret = {
      n: ti++
    };
    if (isCoinBase) {
      ret.isCoinBase = true;
    } else {
      ret.txid = buffertools.reverse(new Buffer(txin.getOutpointHash())).toString('hex');
      ret.vout = txin.getOutpointIndex();
    }
    return ret;
  });

  var to = 0;
  tx.vout = tx.outs.map(function(txout) {
    var val;
    if (txout.s) {
      var s = new Script(txout.s);
      var addrs = new Address.fromScriptPubKey(s, config.network);
      // support only for p2pubkey p2pubkeyhash and p2sh
      if (addrs && addrs.length === 1) {
        val = {
          addresses: [addrs[0].toString()]
        };
      }
    }
    return {
      valueSat: _fromBuffer(txout.v),
      scriptPubKey: val,
      n: to++,
    };
  });
  tx.time = time;
  return tx;
};

module.exports ={
    insert: insert,
    getVout: getVout,
    getStandardizedTx: getStandardizedTx
}