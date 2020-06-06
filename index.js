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
    this.initSocket();
    return this.initElectrum(this.electrumConfig);
  }

  // ElectrumX API
  blockchainBlock_header(height, cp_height) {
    return this.request('blockchain.block.header', [height, cp_height]);
  }
  blockchainBlock_headers(start_height, count, cp_height=0) {
    return this.request('blockchain.block.headers', [start_height, count, cp_height]);
  }
  blockchainEstimatefee(number) {
    return this.request('blockchain.estimatefee', [number]);
  }
  blockchainHeaders_subscribe() {
    return this.request('blockchain.headers.subscribe', []);
  }
  //Deprecated since version 1.4.2.
  blockchain_relayfee() {
    return this.request('blockchain.relayfee', []);
  }
  blockchainScripthash_getBalance(scripthash) {
    return this.request('blockchain.scripthash.get_balance', [scripthash]);
  }
  blockchainScripthash_getHistory(scripthash) {
    return this.request('blockchain.scripthash.get_history', [scripthash]);
  }
  blockchainScripthash_getMempool(scripthash) {
    return this.request('blockchain.scripthash.get_mempool', [scripthash]);
  }
  blockchainScripthash_listunspent(scripthash) {
    return this.request('blockchain.scripthash.listunspent', [scripthash]);
  }
  blockchainScripthash_subscribe(scripthash) {
    return this.request('blockchain.scripthash.subscribe', [scripthash]);
  }
  blockchainScripthash_unsubscribe(scripthash) {
    return this.request('blockchain.scripthash.unsubscribe', [scripthash])
  }
  blockchainTransaction_broadcast(rawtx) {
    return this.request('blockchain.transaction.broadcast', [rawtx]);
  }
  blockchainTransaction_get(tx_hash, verbose=false) {
    return this.request('blockchain.transaction.get', [tx_hash, verbose]);
  }
  blockchainTransaction_getMerkle(tx_hash, height) {
    return this.request('blockchain.transaction.get_merkle', [tx_hash, height]);
  }
  blockchainTransaction_idFromPos(height, tx_pos, merkle=false) {
    return this.request('blockchain.transaction.id_from_pos', [height, tx_pos, merkle]);
  }
  mempool_getFeeHistogram() {
    return this.request('mempool.get_fee_histogram', []);
  }
  server_addPeer(features) {
    return this.request('server.add_peer', [features]);
  }
  server_banner() {
    return this.request('server.banner', []);
  }
  serverDonation_address() {
    return this.request('server.donation_address', []);
  }
  server_features() {
    return this.request('server.features', []);
  }
  serverPeers_subscribe() {
    return this.request('server.peers.subscribe', []);
  }
  server_ping() {
    return this.request('server.ping', []);
  }
  server_version(client_name="", protocol_version="1.4") {
    return this.request('server.version', [client_name, protocol_version]);
  }

  //Batch Request
  blockchainScripthash_getBalanceBatch(scripthash) {
    return this.requestBatch('blockchain.scripthash.get_balance', scripthash);
  }
  blockchainScripthash_listunspentBatch(scripthash) {
    return this.requestBatch('blockchain.scripthash.listunspent', scripthash);
  }
  blockchainScripthash_getHistoryBatch(scripthash) {
    return this.requestBatch('blockchain.scripthash.get_history', scripthash);
  }
  blockchainTransaction_getBatch(tx_hash, verbose) {
    return this.requestBatch('blockchain.transaction.get', tx_hash, verbose);
  }
 
}

module.exports = ElectrumClient;
