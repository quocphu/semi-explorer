create table Blocks(
	hash character(64),
	prevhash character(64),
	height integer,
	data jsonb
);

create table Txes(
	txid character(64),
	blockhash character(64),
	blockheight integer,
	data jsonb
);

create table AddressVin(
	address character(34),
	related character(699),
	txid character(64),
	n integer,
	amount numeric(19),
	ts timestamp without time zone
);

create table AddressVout(
	address character(34),
	related character(699),
	txid character(64),
	n integer,
	amount numeric(19),
	ts timestamp without time zone
);


create index blocks_hash_idx on Blocks(hash);
create index blocks_prevHash_idx on Blocks(prevHash);
create index blocks_height_idx on Blocks(height);


create index txes_txid_idx on txes(txid);
create index txes_blockhash_idx on txes(blockhash);
create index txes_blockheight_idx on txes(blockheight);


create index addressvout_txid_idx on addressvout(txid);
create index addressvout_address_idx on addressvout(address);

create index addressvin_txid_idx on addressvin(txid);


create table AddressVin(
	txid character(64),
	in_txid character(64),
	in_n integer,
	ts timestamp without time zone
);

create index addressvin_txid_idx on addressvin(txid);
create index addressvin_in_txid_idx on addressvin(in_txid);
