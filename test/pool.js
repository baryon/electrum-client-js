const _ = require( 'lodash' )

const { EventEmitter } = require( 'events' )

const servers = require( './servers' )

const ElectrumCli = require( '../index' )

class ElectrumPool extends EventEmitter {
  // 初始化服务器池
  constructor () {
    super()
    this.serverIndex = 0
    this.servers = []
    this.serversMap = {}
    this.init()
  }

  init () {
    this._initServers( servers )
    return this
  }

  async acquire () {
    try {
      const ecl = this._fetchServerFromPool()

      ecl.on( 'connect', async () => {
        // https://electrumx.readthedocs.io/en/latest/protocol-methods.html#server-peers-subscribe
        const peers = await ecl.serverPeers_subscribe()
        const servers = this._parsePeers( peers )

        this._initServers( servers )

        console.log( peers )
        console.log( servers )
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

      ecl.initElectrum({}, null).then(version=>{
        console.log(version)
      }).catch(e=>{
        console.warn(e)
        this._nextServerIndex()
        this.emit( 'error', ecl, error )
      })
      return ecl
    } catch ( e ) {
      this._nextServerIndex()
      return Promise.reject( e )
    }
  }

  closeAll () {
    for ( const ecl of this.servers ) {
      ecl.close()
    }
  }

  /// ////////////////////////////////

  _nextServerIndex () {
    this.serverIndex = ( 1 + this.serverIndex ) % this.servers.length
  }

  _fetchServerFromPool () {
    const ecl = this.servers[ this.serverIndex ]
    console.debug( this.serverIndex, ecl.host, ecl.port, ecl._protocol, ecl.status )
    return ecl
  }

  _parsePeers ( peers ) {
    // https://electrumx.readthedocs.io/en/latest/protocol-methods.html#server-peers-subscribe
    const servers = {}
    _.each( peers, ( value ) => {
      //const host = value[0]
      const host = value[ 1 ]
      const params = value[ 2 ]
      let version = '1.4'
      let s = ''
      let t = ''
      let pruning = '-'
      _.each( params, ( param ) => {
        const prefix = param.substr( 0, 1 )
        const surfix = param.substr( 1 )
        switch ( prefix ) {
          case 'v':
            version = surfix
            break
          case 's':
            s = surfix
            break
          case 't':
            t = surfix
            break
          case 'p':
            pruning = surfix
            break
        }
      } )
      if ( host ) {
        servers[ host ] = {
          pruning, version
        }
        if ( s !== '' ) {
          servers[ host ].s = s
        }
        if ( t !== '' ) {
          servers[ host ].t = t
        }
      }
    } )
    return servers
  }

  _initServers ( servers ) {
    _.each( servers, ( value, host ) => {
      if ( value.s ) {
        const key = `${host}_tls`

        const existServer = this.serversMap[ key ]
        if ( existServer === undefined ) {
          this.serversMap[ key ] = new ElectrumCli( value.s, host, 'tls' )
          this.servers.push( this.serversMap[ key ] )
        }
      }
      if ( value.t ) {
        const key = `${host}_tcp`

        const existServer = this.serversMap[ key ]
        if ( existServer === undefined ) {
          this.serversMap[ key ] = new ElectrumCli( value.t, host, 'tcp' )
          this.servers.push( this.serversMap[ key ] )
        }
      }
    } )
  }
}

module.exports = ElectrumPool
