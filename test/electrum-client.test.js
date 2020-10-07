const { mapAddressToScriptHash } = require( './address' )
const ElectrumPool = require( './pool' )

require( 'mocha' )
const assert = require( 'chai' ).assert

const sleep = ( ms ) => new Promise( ( resolve, _ ) => setTimeout( () => resolve(), ms ) )

describe( 'ElectrumClient', async () => {
  beforeEach( async () => {

  } )
  it( 'init', async () => {
    const electrum = new ElectrumPool()
    const ecl = await electrum.acquire()
    const banner = await ecl.server_banner()
    console.log( banner )
    assert.isObject( ecl )
  } )

  it( 'Ecl Balance', async () => {
    const electrum = new ElectrumPool()
    const ecl = await electrum.acquire()
    const address = '1Pwmd4RCoTbYP6tLWVoDcys1GW5chsve8C' //'1JQtjapAbhUVdBBFH1Z7dsE8gGgnxVDxRH'
    try {
      const { scriptHash } = mapAddressToScriptHash( address )
      const balance = await ecl.blockchainScripthash_getBalance( scriptHash )
      console.log( balance )
    } catch ( e ) {
      console.debug( e )
    }

    assert.isObject( ecl )
  } )

  it( 'fetchHistories', async () => {
    const electrum = new ElectrumPool()
    const ecl = await electrum.acquire()
    const addressStr = '1JQtjapAbhUVdBBFH1Z7dsE8gGgnxVDxRH'// '1LoqTWSXrd7D5yv8vKfk5onnFuVJbph74n' //
    try {
      const { scriptHash } = mapAddressToScriptHash( addressStr )
      const histories = await ecl.blockchainScripthash_getHistory( scriptHash )
      console.log( histories.length, histories )
    } catch ( e ) {
      console.debug( e )
    }

    assert.isObject( ecl )
  } ).timeout( 1500000 )

  it( 'fetchRawTx', async () => {
    const electrum = new ElectrumPool()
    const ecl = await electrum.acquire()
    const txHash = 'a3d9bb5a9d26c15fa5356fe6ea555e7ae4a7262bee485464c9625a0e64028c7f'
    const txObject = await ecl.blockchainTransaction_get( txHash )
    console.log( txObject )
    assert.isString( txObject )
  } ).timeout( 1500000 )

  // it('broadcast', async () => {
  //   const electrum = new ElectrumPool()
  //   const ecl = await electrum.acquire()
  //   const rawHex = '0200000001e0d2128a554d7793352b3478c2339d4c6ba12f294584a2bcfd494daa106769e7000000006b483045022100863549e778bba1f8f8617c77bb286d161463a7b1ebd68d58c9e60e7f96c9afde022038d693ffe511685471b199ed90a806ac84e4ba2ab66ac1f3e160eb5f129452ab4121038fc908bdbac664624c0cca5e1c2c80a73af51f237e95a45b56f1a45446cb1a9bffffffff01bc020000000000001976a914950a65a1ffdde0931dcf2e3b0a1ce8142d43bfb888ac00000000'
  //   const hash = await ecl.blockchain_transaction_broadcast(rawHex)
  //   console.log(hash)
  //   assert.isString(hash)
  // })

  it( 'selectUtxos', async () => {
    const electrum = new ElectrumPool()
    const ecl = await electrum.acquire()

    const utxos = []
    let satoshiTotal = 0, count = 0
    const amount = 123045
    const addressStr = '1Pwmd4RCoTbYP6tLWVoDcys1GW5chsve8C'// '1JQtjapAbhUVdBBFH1Z7dsE8gGgnxVDxRH'

    const addressList = [ addressStr ]
    for ( const addressStr of addressList ) {
      const { scriptHex, scriptHash } = mapAddressToScriptHash( addressStr )
      const unspent = await ecl.blockchainScripthash_listunspent( scriptHash )

      for ( const utxo of unspent ) {
        utxos.push( {
          txId: utxo.tx_hash,
          outputIndex: utxo.tx_pos,
          address: addressStr,
          script: scriptHex,
          satoshis: utxo.value
        } )

        satoshiTotal += utxo.value
        count++
        if ( satoshiTotal > ( amount + ( 192 * count ) / 1000 ) && count > 3 ) {
          break
        }
      }
    }

    console.log( utxos.length, satoshiTotal, amount, utxos )
    assert.isArray( utxos )
  } ).timeout( 1500000 )


  it( 'subscribe headers', async () => {
    const electrum = new ElectrumPool()
    const ecl = await electrum.acquire()
    const listner = ( result ) => {
      console.log( this, result )
    }
    ecl.subscribe.on( 'blockchain.headers.subscribe', listner, this )

    const result = await ecl.blockchainHeaders_subscribe()
    console.log( result )
    assert.isObject( ecl )

    await sleep(150000)
  } ).timeout( 1500000 )

} )
