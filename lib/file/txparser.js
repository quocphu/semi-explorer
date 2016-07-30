var bitcoinjs = require('bitcoinjs-lib'),
util=require('util'),
networks = require('../../config/networks.js'),
bs58check = require('bs58check');

var Script = bitcoinjs.script;

/**
 * Parse transaction to json object from transaction raw
 * @param raw Raw transaction 
 * @param network Version by of network
 * @returns
 */
function parse(tx, network){	
//    var tx = bitcoinjs.Transaction.fromHex(raw);
    var txid = tx.getId();
    var rs = {};
    rs.hex = tx.toHex();
    rs.version = tx.version;
    rs.locktime = tx.locktime;
    rs.txid = txid;
    
    var pubkeyLen = 66;
    if(network.pubkeyLen) {
        pubkeyLen = network.pubkeyLen;
    }

    var ins = tx.ins;
    var nIns=[];
    // Loop through vin
    for(var i = 0; i<tx.ins.length; i++){
        var item= {};
        item.sequence = ins[i].sequence;
        var prevTxid = [].reverse.call(ins[i].hash).toString('hex');

        if(prevTxid == '0000000000000000000000000000000000000000000000000000000000000000'){
            item.coinbase = ins[i].script.toString('hex');
        } else {
            item.txid = prevTxid;
            item.vout = ins[i].index;
        }
        nIns.push(item);
    }
    rs.vin = nIns;

    var outs = tx.outs;
    var nOuts = [];
    for(var i = 0; i < outs.length; i++) {
        var item = {};
        item.value = outs[i].value;
        item.n = i;
        var script = Script.compile(outs[i].script);
        var scriptPubKey = {};
        scriptPubKey.asm = Script.toASM(script);
        scriptPubKey.hex = outs[i].script.toString('hex');
        scriptPubKey.type = classifyOutput(script);
        scriptPubKey.addresses = [];
        var reqSigs = 1;

        if(scriptPubKey.type =='pubkeyhash') {
            var address = createAddress(script.slice(3, 23), network.pubKeyHash);
            scriptPubKey.addresses.push(address);
        } else if(scriptPubKey.type=='scripthash') {
            var address = createAddress(script.slice(2, 22), network.scriptHash);
            scriptPubKey.addresses.push(address);
        } else if(scriptPubKey.type=='pubkey') {
            var address = createAddress(script.slice(1, pubkeyLen), network.pubKeyHash);
            scriptPubKey.addresses.push(address);
        } else if(scriptPubKey.type=='multisig') {
            var n = script[0] % 80;
            var m = script[script.length - 2] % 80;
            var lenIndex = 1;
            reqSigs = n;
            for(var j = 0; j < m; j++) {
                var length = script[lenIndex];
                var publicKey = script.slice(lenIndex +1, length + lenIndex + 1);
                var address = createAddress(publicKey, network.pubKeyHash);
                scriptPubKey.addresses.push(address);
                lenIndex = lenIndex + length + 1;
            }
        }
        item.scriptPubKey = scriptPubKey;
        item.reqSigs = reqSigs;
        nOuts.push(item);
    }

    rs.vout = nOuts;
    
    return rs;
}

/**
 * Create address from public key
 * @param pubKey Public key(buffer) 
 * @param prefix Version by of network
 * @returns
 */
function createAddress(pubKey, prefix) {
//    console.log('pubKey: ', pubKey.toString('hex'));
    var pubkeyRipemd160 = null;
    // Create buffer
    if(pubKey.length != 20) {
        // 2 - Perform SHA-256 hashing on the public key 
        var pubKeyHash256 = bitcoinjs.crypto.sha256(pubKey);

        // 3 - Perform RIPEMD-160 hashing on the result of SHA-256 
        pubkeyRipemd160 = bitcoinjs.crypto.ripemd160(pubKeyHash256);
    }
    else {
        pubkeyRipemd160 = pubKey;
    }
    // 4 - Add version byte in front of RIPEMD-160 hash
    var mainNetParam=new Buffer ([prefix]);
    var pubkeyAddParam = Buffer.concat([mainNetParam, pubkeyRipemd160]);

    // 5-8  Base58Check encoding
    var address= bs58check.encode(pubkeyAddParam);
    return address;
}

function classifyOutput(script){
    var type = Script.classifyOutput(script);

    var lastByte = script[script.length-1];

    if(type =='nonstandard' && lastByte == 174){
        return 'multisig';
    }
    return type;
}

module.exports = {
    parse: parse,
    createAddress: createAddress
};