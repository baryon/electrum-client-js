const bsv = require('bsv')

const mapAddressToScriptHash = ( address, network ) => {
  const bsvAddress = bsv.Address.fromString( address, network )
  const script = bsv.Script.fromAddress( bsvAddress )
  // 获取ASM脚本
  // OP_DUP OP_HASH160 2d71a93e40de14da35e1c514bc917869de3cbc6e OP_EQUALVERIFY OP_CHECKSIG
  // address has P2PKH script
  const addressScriptHex = script.toHex()
  // with SHA256 hash:
  const hash256 = bsv.crypto.Hash.sha256( script.toBuffer() )
  // which is sent to the server reversed as:
  const reversedHash256 = hash256.reverse()
  const reversedHash256Hex = reversedHash256.toString( 'hex' )
  return {scriptHex: addressScriptHex, scriptHash : reversedHash256Hex}
}

module.exports = {
  mapAddressToScriptHash,
}
