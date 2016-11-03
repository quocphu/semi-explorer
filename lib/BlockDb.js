
var BlockDb = function(){};

BlockDb.insert = function(blocks, db, cb){
    var iBlockQ = '';
    iBlockQ = "insert into Blocks(hash, prevHash, height, time, data) values";
    for(var i = 0; i < blocks.length; i++){
        iBlockQ += "(";
        iBlockQ += "'" + blocks[i].hash + "',";
        iBlockQ += "'" + (blocks[i].prevHash || blocks[i].previousblockhash) + "',";
        iBlockQ += "" + (blocks[i].height || 0) + ",";
        iBlockQ += "to_timestamp(" + blocks[i].time + "),";
        iBlockQ += "'" + JSON.stringify(blocks[i]) + "'";
        iBlockQ += ")";
        if(i < blocks.length - 1){
            iBlockQ += ",";
        }
    }
    iBlockQ += ";";
    // console.log(iBlockQ);
    db.query(iBlockQ, function(err, result){
        return cb(err, result);
    });
}

module.exports = BlockDb;