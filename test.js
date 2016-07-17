var bitcore     = require('bitcore');
var bitcoreUtil = bitcore.util;
var buffertools = require('buffertools');
var Script = bitcore.Script;
var base58 = require('base58-native').base58Check;

//var pubKey = "02ed07fe6f1ce6f29d67a42521c17451e6b5ce8e380ed4931950a2c20bb86a0acc";
 pubKey = "04cc71eb30d653c0c3163990c47b976f3fb3f37cccdcbedb169a1dfef58bbfbfaff7d8a473e7e2e6d317b87bafe8bde97e3cf8f065dec022b51d11fcdd0d348ac4"
 // pubKey = "0450863AD64A87AE8A2FE83C1AF1A8403CB53F53E486D8511DAD8A04887E5B23522CD470243453A299FA9E77237716103ABC11A1DF38855ED6F2EE187E9C582BA6";
// twoSha256
// sha256
// ripe160

pubKey = "44022             0569ec6d2e81625dd18c73920e0079cdb4c1d67d3d7616759eb0c18cf566b3d3402201c60318f0a62e3ba85ca0f";
// pubKey = "8d4dfe63c0779269eb6765b6fc939fc51e7a8ea901"
pubKey = new Buffer(pubKey,'hex')
console.log('len: ' + pubKey.length)
//1GJ9W3eRW46xPY8SQXZiAbY3T83GvFJfFx
//1JExBRZjkPPo37HD1cLdS1ctJ68cPCN6Pc

    var pubkeyRipemd160 = null;
    // Create buffer
    if(pubKey.length != 20) {
        // 2 - Perform SHA-256 hashing on the public key 
        var pubKeyHash256 = bitcoreUtil.sha256(pubKey);
        console.log('sha256: ' + pubKeyHash256.toString('hex'))
        // 3 - Perform RIPEMD-160 hashing on the result of SHA-256 
        pubkeyRipemd160 = bitcoreUtil.ripe160(pubKeyHash256);
        console.log('RIPEMD-160: ' + pubkeyRipemd160.toString('hex'))
    }
    else {
        pubkeyRipemd160 = pubKey;
    }

    // 4 - Add version byte in front of RIPEMD-160 hash
    var mainNetParam=new Buffer ([0x00]);
    var pubkeyAddParam = Buffer.concat([mainNetParam, pubkeyRipemd160]);

    // 5-8  Base58Check encoding
    var address= base58.encode(pubkeyAddParam);

console.log(address);