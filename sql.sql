
// unspent txid, n
select address, txid, n
from AddressVout
where address ='address'
except
select address, txid, n
from AddressVin
where address ='address'

// balance

select vout.address, vout.receive - vin.send
from 
(select max(address), sum(value) receive
from AddressVout
where address ='address') vout
,
(select max(address), sum(value) as send
from AddressVin
where address ='address') vin