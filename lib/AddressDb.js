function insert(table, addresses, db, cb) {
    if(addresses.length == 0){
        return cb(null);
    }
    
    var iAddrQ = '';
    iAddrQ = "insert into " + table + "(address, related, txid, n, amount, ts) values";
    for(var i = 0; i < addresses.length; i++){
        iAddrQ += "(";
        iAddrQ += "'" + addresses[i].address + "',";
        iAddrQ += "'" + addresses[i].related + "',";
        iAddrQ += "'" + addresses[i].txid + "',";
        iAddrQ += "" + addresses[i].n + ",";
        iAddrQ += "" + addresses[i].amount + ",";
        iAddrQ += "to_timestamp('" + addresses[i].ts + "')";
        iAddrQ += ")";
        if(i < addresses.length - 1){
            iAddrQ += ",";
        }
    }
    iAddrQ += ";";
    
    db.query(iAddrQ, function(err, result){
        if(err){
            console.log(err);
            console.log(iAddrQ);
            return cb(err);
        }
        return cb(null, result);
    });
}

function insertVout(addresses, db, cb) {
    var table = 'AddressVout';
    return insert(table, addresses, db, cb);
}

function insertVin(txs, db, cb) {
    if(txs.length == 0){
        return cb(null);
    }
    
    var iAddrQ = '';
    iAddrQ = "insert into AddressVin(txid, in_txid, in_n, ts) values";
    for(var i = 0; i < txs.length; i++){
        iAddrQ += "(";
        iAddrQ += "'" + txs[i].txid + "',";
        iAddrQ += "'" + txs[i].in_txid + "',";
        iAddrQ += "" + txs[i].in_n + ",";
        iAddrQ += "to_timestamp('" + txs[i].ts + "')";
        iAddrQ += ")";
        if(i < txs.length - 1){
            iAddrQ += ",";
        }
    }
    iAddrQ += ";";
    
    db.query(iAddrQ, function(err, result){
        if(err){
            console.log(err);
            console.log(iAddrQ);
            return cb(err);
        }
        return cb(null, result);
    });
}

module.exports ={
    insertVout: insertVout,
    insertVin: insertVin
}