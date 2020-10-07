/**
 * protocol 1.4 
 * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#
 */
'use strict';

const Client = require('./lib/client');

class ElectrumClient extends Client {
  constructor(port, host, protocol, options) {
    super(port, host, protocol, options);
    this.timeLastCall = 0;
  }

  initElectrum(electrumConfig, persistencePolicy = { maxRetry: 1000, callback: null }) {
    this.persistencePolicy = persistencePolicy;
    this.electrumConfig = electrumConfig;
    this.timeLastCall = 0;
    return this.connect().then(() => this.server_version(this.electrumConfig.client, this.electrumConfig.version));
  }

  // Override parent
  request(method, params) {
    this.timeLastCall = new Date().getTime();
    const parentPromise = super.request(method, params);
    return parentPromise.then(response => {
      this.keepAlive();
      return response;
    });
  }

  requestBatch(method, params, secondParam) {
    this.timeLastCall = new Date().getTime();
    const parentPromise = super.requestBatch(method, params, secondParam);
    return parentPromise.then(response => {
      this.keepAlive();
      return response;
    });
  }

  onClose() {
    super.onClose();
    const list = [
      'server.peers.subscribe',
      'blockchain.scripthash.subscribe',
      'blockchain.headers.subscribe'
    ];
    list.forEach(event => this.subscribe.removeAllListeners(event));
    setTimeout(() => {
      if (this.persistencePolicy != null && this.persistencePolicy.maxRetry > 0) {
        this.reconnect();
        this.persistencePolicy.maxRetry -= 1;
      } else if (this.persistencePolicy != null && this.persistencePolicy.callback != null) {
        this.persistencePolicy.callback();
      } else if (this.persistencePolicy == null) {
        this.reconnect();
      }
    }, 10000);
  }

  // ElectrumX persistancy
  keepAlive() {
    if (this.timeout != null) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      if (this.timeLastCall !== 0 && new Date().getTime() > this.timeLastCall + 5000) {
        this.server_ping();
      }
    }, 5000);
  }

  close() {
    super.close();
    if (this.timeout != null) {
      clearTimeout(this.timeout);
    }
    this.reconnect = this.reconnect = this.onClose = this.keepAlive = () => {}; // dirty hack to make it stop reconnecting
  }

  reconnect() {
    super.initSocket();
    return this.initElectrum(this.electrumConfig);
  }

  // ElectrumX API

  /**
   * Return the block header at the given height.
   * ref: https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-block-header
   * @param {*} height The height of the block, a non-negative integer.
   * @param {*} cp_height Checkpoint height, a non-negative integer. Ignored if zero, otherwise the following must hold: height <= cp_height
   */
  blockchainBlock_header(height, cp_height) {
    return this.request('blockchain.block.header', [height, cp_height]);
  }
  /**
   * Return a concatenated chunk of block headers from the main chain.
   * ref: https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-block-headers
   * @param {*} start_height The height of the first header requested, a non-negative integer.
   * @param {*} count The number of headers requested, a non-negative integer.
   * @param {*} cp_height Checkpoint height, a non-negative integer. Ignored if zero, otherwise the following must hold:start_height + (count - 1) <= cp_height
   */
  blockchainBlock_headers(start_height, count, cp_height=0) {
    return this.request('blockchain.block.headers', [start_height, count, cp_height]);
  }

  /**
   * Return the estimated transaction fee per kilobyte for a transaction to be confirmed within a certain number of blocks.
   * Deprecated since version 1.4.2.
   * ref:https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-estimatefee
   * @param {*} number The number of blocks to target for confirmation.
   */
  blockchainEstimatefee(number) {
    return this.request('blockchain.estimatefee', [number]);
  }

  /**
   * Subscribe to receive block headers when a new block is found.
   * ref: https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-headers-subscribe
   * 
   */
  blockchainHeaders_subscribe() {
    return this.request('blockchain.headers.subscribe', []);
  }

  /**
   * Return the minimum fee a low-priority transaction must pay in order to be accepted to the daemon’s memory pool.
   * Deprecated since version 1.4.2.
   */
  blockchain_relayfee() {
    return this.request('blockchain.relayfee', []);
  }

  /**
   * Return the confirmed and unconfirmed balances of a script hash.
   * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-scripthash-get-balance
   * 
   * @param  {...any} scripthashs The script hash as a hexadecimal string.
   */
  blockchainScripthash_getBalance(...scripthash) {
    return this.request('blockchain.scripthash.get_balance', scripthash);
  }

  /**
   * Return the confirmed and unconfirmed history of a script hash.
   * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-scripthash-get-history
   * 
   * @param  {...any} scripthashs The script hash as a hexadecimal string.
   * Result
   * A list of confirmed transactions in blockchain order, with the output of blockchain.scripthash.get_mempool() appended to the list. Each confirmed transaction is a dictionary with the following keys:
   * height
   * The integer height of the block the transaction was confirmed in.
   * tx_hash
   * The transaction hash in hexadecimal.
   */
  blockchainScripthash_getHistory(...scripthash) {
    return this.request('blockchain.scripthash.get_history', scripthash);
  }

  /**
   * Return the unconfirmed transactions of a script hash.
   * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-scripthash-get-mempool
   * 
   * @param  {...any} scripthashs The script hash as a hexadecimal string.
   * Result
   * A list of mempool transactions in arbitrary order. Each mempool transaction is a dictionary with the following keys:
   * height
   * 0 if all inputs are confirmed, and -1 otherwise.
   * tx_hash
   * The transaction hash in hexadecimal.
   * fee
   * The transaction fee in minimum coin units (satoshis).
   */
  blockchainScripthash_getMempool(...scripthash) {
    return this.request('blockchain.scripthash.get_mempool', scripthash);
  }

  /**
   * Return an ordered list of UTXOs sent to a script hash.
   * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-scripthash-listunspent
   * 
   * @param  {...any} scripthashs The script hash as a hexadecimal string.
   * Result
   * A list of unspent outputs in blockchain order. This function takes the mempool into account. Mempool transactions paying to the address are included at the end of the list in an undefined order. Any output that is spent in the mempool does not appear. Each output is a dictionary with the following keys:
   * height
   * The integer height of the block the transaction was confirmed in. 0 if the transaction is in the mempool.
   * tx_pos
   * The zero-based index of the output in the transaction’s list of outputs.
   * tx_hash
   * The output’s transaction hash as a hexadecimal string.
   * value
   * The output’s value in minimum coin units (satoshis).
   */
  blockchainScripthash_listunspent(...scripthash) {
    return this.request('blockchain.scripthash.listunspent', scripthash);
  }

  /**
   * Subscribe to a script hash.
   * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-scripthash-subscribe
   * 
   * @param  {...any} scripthashs The script hash as a hexadecimal string.
   */
  blockchainScripthash_subscribe(...scripthash) {
    return this.request('blockchain.scripthash.subscribe', scripthash);
  }

  /**
   * Unsubscribe from a script hash, preventing future notifications if its status changes.
   * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-scripthash-unsubscribe
   * New in version 1.4.2.
   * 
   * @param  {...any} scripthashs The script hash as a hexadecimal string.
   */
  blockchainScripthash_unsubscribe(...scripthash) {
    return this.request('blockchain.scripthash.unsubscribe', scripthash)
  }

  /**
   * Broadcast a transaction to the network.
   * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-transaction-broadcast
   * 
   * @param  {...any} rawtxs The raw transaction as a hexadecimal string.
   * Result
   * The transaction hash as a hexadecimal string.
   * Note protocol version 1.0 (only) does not respond according to the JSON RPC specification if an error occurs. If the daemon rejects the transaction, 
   * the result is the error message string from the daemon, as if the call were successful. 
   * The client needs to determine if an error occurred by comparing the result to the expected transaction hash.
   * Protocol version 1.0 returning an error as the result: "258: txn-mempool-conflict"
   */
  blockchainTransaction_broadcast(...rawtx) {
    return this.request('blockchain.transaction.broadcast', rawtx);
  }

  /**
   * Return a raw transaction.
   * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-transaction-get
   * 
   * @param {*} tx_hash The transaction hash as a hexadecimal string.
   * @param {*} verbose Whether a verbose coin-specific response is required.
   * Result
   * If verbose is false:
   * The raw transaction as a hexadecimal string.
   * If verbose is true:
   * The result is a coin-specific dictionary – whatever the coin daemon returns when asked for a verbose form of the raw transaction.
   */
  blockchainTransaction_get(tx_hash, verbose=false) {
    return this.request('blockchain.transaction.get', [tx_hash, verbose]);
  }


  /**
   * Return the merkle branch to a confirmed transaction given its hash and height.
   * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-transaction-get-merkle
   * 
   * @param {*} tx_hash The transaction hash as a hexadecimal string.
   * @param {*} height The height at which it was confirmed, an integer.
   * Result
   * A dictionary with the following keys:
   * block_height
   * The height of the block the transaction was confirmed in.
   * merkle
   * A list of transaction hashes the current hash is paired with, recursively, in order to trace up to obtain merkle root of the block, deepest pairing first.
   * pos
   * The 0-based index of the position of the transaction in the ordered list of transactions in the block.
   */
  blockchainTransaction_getMerkle(tx_hash, height) {
    return this.request('blockchain.transaction.get_merkle', [tx_hash, height]);
  }


  /**
   * Return a transaction hash and optionally a merkle proof, given a block height and a position in the block.
   * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#blockchain-transaction-id-from-pos
   * 
   * @param {*} height The main chain block height, a non-negative integer.
   * @param {*} tx_pos A zero-based index of the transaction in the given block, an integer.
   * @param {*} merkle Whether a merkle proof should also be returned, a boolean.
   */
  blockchainTransaction_idFromPos(height, tx_pos, merkle=false) {
    return this.request('blockchain.transaction.id_from_pos', [height, tx_pos, merkle]);
  }

  /**
   * Return a histogram of the fee rates paid by transactions in the memory pool, weighted by transaction size.
   * Deprecated since version 1.4.2.
   */
  mempool_getFeeHistogram() {
    return this.request('mempool.get_fee_histogram', []);
  }

  /**
   * A newly-started server uses this call to get itself into other servers’ peers lists. It should not be used by wallet clients.
   * 
   * @param {*} features The same information that a call to the sender’s server.features() RPC call would return.
   */
  server_addPeer(features) {
    return this.request('server.add_peer', [features]);
  }

  /**
   * Return a banner to be shown in the Electrum console.
   */
  server_banner() {
    return this.request('server.banner', []);
  }
  /**
   * Return a server donation address.
   */
  serverDonation_address() {
    return this.request('server.donation_address', []);
  }
  /**
   * Return a list of features and services supported by the server.
   * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#server-features
   */
  server_features() {
    return this.request('server.features', []);
  }
  /**
   * Return a list of peer servers. Despite the name this is not a subscription and the server must send no notifications.
   * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#server-peers-subscribe
   */
  serverPeers_subscribe() {
    return this.request('server.peers.subscribe', []);
  }

  /**
   * Ping the server to ensure it is responding, and to keep the session alive. The server may disconnect clients that have sent no requests for roughly 10 minutes.
   * 
   */
  server_ping() {
    return this.request('server.ping', []);
  }

  /**
   * Identify the client to the server and negotiate the protocol version. Only the first server.version() message is accepted.
   * https://electrumx.readthedocs.io/en/latest/protocol-methods.html#server-version
   * 
   * @param {*} client_name 
   * @param {*} protocol_version 
   */
  server_version(client_name="", protocol_version="1.4") {
    return this.request('server.version', [client_name, protocol_version]);
  }

  //Batch Request
  blockchainScripthash_getBalanceBatch(...scripthashs) {
    return this.requestBatch('blockchain.scripthash.get_balance', scripthashs);
  }
  blockchainScripthash_listunspentBatch(...scripthashs) {
    return this.requestBatch('blockchain.scripthash.listunspent', scripthashs);
  }
  blockchainScripthash_getHistoryBatch(...scripthashs) {
    return this.requestBatch('blockchain.scripthash.get_history', scripthashs);
  }
  blockchainTransaction_getBatch(tx_hash, verbose) {
    return this.requestBatch('blockchain.transaction.get', tx_hash, verbose);
  }
 
}

module.exports = ElectrumClient;
