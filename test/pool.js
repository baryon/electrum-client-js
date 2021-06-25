const _ = require( 'lodash' )
const { mapAddressToScriptHash } = require( './address' )

const { EventEmitter } = require( 'events' )


const ElectrumCli = require( '../index' )

class ElectrumPool extends EventEmitter {
  // 初始化服务器池
  constructor (network, hosts) {
    super()
    this.network = network
    this.currentServerIndex = 0
    this.serversMap = new Map()
    this.servers = []
    this._initHosts(new Map(Object.entries(hosts)));
  }

  connect(ecl) {

      ecl.on( 'connect', async () => {
        // https://electrumx.readthedocs.io/en/latest/protocol-methods.html#server-peers-subscribe
        const hostServers = await ecl.serverPeers_subscribe()
        const peerHosts = this._parseHosts(hostServers);
        this._initHosts(new Map(Object.entries(peerHosts)));

        console.log( hostServers )
        console.log( peerHosts )
        console.log( _.map( this.servers, ( server ) => {
          return [ server.host, server.port, server._protocol ]
        } ))

        this.emit( 'connect', ecl )
      } )

      ecl.on( 'close', () => {
        console.log( 'close event', ecl.host, ecl.port, ecl.protocol, ecl.status )

        this.emit( 'close', ecl )
      } )

      ecl.on( 'end', ( error ) => {
        console.log( 'end event', ecl.host, ecl.port, ecl.protocol, ecl.status )

        this.emit( 'end', ecl, error )
      } )

      ecl.on( 'error', ( error ) => {
        console.log( `onError: [${error}]`, error.status, error.message, ecl.host, ecl.port, ecl.protocol, ecl.status )
        this._nextServerIndex()
        this.emit( 'error', ecl, error )
      } )

      return ecl.initElectrum({}, null)
  }

  async acquire() {
    for (let index = this.currentServerIndex; index < this.currentServerIndex + this.servers.length; index++) {
      const ecl = this.servers[index % this.servers.length];
      try {
        console.log(ecl.host, ecl.port)
        return await this.connect(ecl);
      } catch (e) {
        console.log(e);
      }
    }
    //没有可用的服务器
    return Promise.reject(new Error('NoElectrumServer'));
  }

  closeAll () {
    for ( const ecl of this.servers ) {
      ecl.close()
    }
  }

  /// ////////////////////////////////

  _nextServerIndex () {
    this.serverIndex = ( ++this.serverIndex ) % this.servers.length
  }

  _parseHosts(hostServers) {
    // https://electrumx.readthedocs.io/en/latest/protocol-methods.html#server-peers-subscribe
    const result = {};
    _.each(hostServers, (value) => {
      const host = value[1];
      const params = value[2];
      let version = '1.4';
      let s = '';
      let t = '';
      let pruning = '-';
      _.each(params, (param) => {
        if (!param) return;
        const prefix = param.substr(0, 1);
        const surfix = param.substr(1);
        switch (prefix) {
          case 'v':
            version = surfix;
            break;
          case 's':
            s = surfix;
            break;
          case 't':
            t = surfix;
            break;
          case 'p':
            pruning = surfix;
            break;
        }
      });
      if (host) {
        result[host] = {
          pruning,
          version,
        };
        if (s !== '') {
          result[host].s = s;
        }
        if (t !== '') {
          result[host].t = t;
        }
      }
    });
    return result;
  }

  _initHosts(hosts) {
    for (const [host, value] of hosts.entries()) {
      if (value.s) {
        const key = `${host}_tls`;

        if (!this.serversMap.has(key)) {
          this.serversMap.set(key, new ElectrumCli(value.s, host, 'tls'));
          const ecl = this.serversMap.get(key)
          this.servers.push(ecl ? ecl : new ElectrumCli());
        }
      }
      if (value.t) {
        const key = `${host}_tcp`;

        if (!this.serversMap.has(key)) {
          this.serversMap.set(key, new ElectrumCli(value.t, host, 'tcp'));
          const ecl = this.serversMap.get(key)
          this.servers.push(ecl ? ecl : new ElectrumCli());
        }
      }
    }
  }

  balance(walletAddressStr) {
    const { scriptHash } = mapAddressToScriptHash(walletAddressStr, this.network);
    return this.acquire().then((ecl) => {
      console.log('connected', ecl.host, ecl.port, ecl.protocol, ecl.status);
      return ecl.blockchainScripthash_getBalance(scriptHash);
    }).catch(e=>{
      console.log("AAAAAA",e)
      throw e
    });
  }
}

module.exports = ElectrumPool
