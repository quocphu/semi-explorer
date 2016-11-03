var socket = {
    event: {
        new_block : 'new-block',
        new_tx : 'new-tx',
        new_tx_block : 'new-tx-in-block',
        subscribe : 'subscribe'
    },
    room: {
        block: 'block',
        tx : 'tx',
        inv : 'inv'
    }
}

module.exports= {
    socket: socket
}