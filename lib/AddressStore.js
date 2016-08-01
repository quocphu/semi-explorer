var AddressDb = require('./AddressDb');

var AddressStore = function(){
  this.vin = [];
  this.vout = [];
  this.isInsertVin = false;
  this.isInsertVout = false;
};


AddressStore.prototype.storeAddressVout = function(tx, db, cb){
  var self = this;
  if(self.isInsertVout) {
    console.log('storeAddressVout is running, wait in 2s');
    return setTimeout(function(){self.storeAddressVout(tx, db, cb);}, 1000);
  }
  
  self.isInsertVout = true;
var count = 0;
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
      self.vout.push(item);
      count = i*j;
    }
  }

  if(self.vout.length >= 100) {
    return AddressDb.insertVout(self.vout, db, function(err){
      self.vout = [];
      self.isInsertVout = false;
      return cb(err);
    });
  }
  self.isInsertVout = false;
  return cb(null, self.vout.length);
}

AddressStore.prototype.storeAddressVin = function (tx, db, cb){
  var self = this;
  if(self.isInsertVin) {
    console.log('storeAddressVin is running, wait in 2s');
    return setTimeout(function(){self.storeAddressVin(tx, db, cb);}, 2000);
  }
var count = 0;
  self.isInsertVin = true;
  for(var i = 0; i < tx.vin.length; i++) {
    if(tx.vin[i].coinbase){
      continue;
    }

    var item = {
      txid: tx.txid,
      in_txid: tx.vin[i].txid,
      in_n: tx.vin[i].vout,
      ts: tx.time
    };

    self.vin.push(item);
  }

  if(self.vin.length >= 100){
    AddressDb.insertVin(self.vin, db, function(err){
      self.vin = [];
      self.isInsertVin = false;
      return cb(err);
    });
  } else {
    self.isInsertVin = false;
    return cb(null, self.vin.length);
  }
}

AddressStore.prototype.pushAll = function (db, cb){
  var self = this;
  if(self.isInsertVin || self.isInsertVout) {
    console.log('storeAddressVin or storeAddressVout is running, wait in 1s');
    return setTimeout(function(){
      self.pushAll(db, cb);
    }, 1000);
  }

  self.isInsertVin = true;
  self.isInsertVout = true;

  var rs = self.vin.length + self.vout.length;
  AddressDb.insertVin(self.vin, db, function(err){
    self.vin = [];
    self.isInsertVin = false;
    if(err){
      self.isInsertVout = false;
      return cb(err);
    }

    AddressDb.insertVout(self.vout, db, function(err){
      self.vout = [];
      self.isInsertVout = false;
      return cb(err, rs);
    });
  });
}

module.exports = AddressStore;