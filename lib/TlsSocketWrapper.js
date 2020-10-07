/**
 * Simple wrapper to mimick Socket class from NET package, since TLS package havs slightly different API.
 * We implement several methods that TCP sockets are expected to have. We will proxy call them as soon as
 * realt TLS socket will be created (TLS socket created after connection).
 */
const EventEmitter = require('eventemitter3');

class TlsSocketWrapper extends EventEmitter {
  constructor(tls) {
    super()
    this._tls = tls; // dependency injection lol
    this._socket = false;
    // defaults:
    this._timeout = 5000;
    this._encoding = 'utf8';
    this._keepAliveEneblad = true;
    this._keepAliveinitialDelay = 0;
    this._noDelay = true;
    this._listeners = {};
  }

  setTimeout(timeout) {
    if (this._socket) this._socket.setTimeout(timeout);
    this._timeout = timeout;
  }

  setEncoding(encoding) {
    if (this._socket) this._socket.setEncoding(encoding);
    this._encoding = encoding;
  }

  setKeepAlive(enabled, initialDelay) {
    if (this._socket) this._socket.setKeepAlive(enabled, initialDelay);
    this._keepAliveEneblad = enabled;
    this._keepAliveinitialDelay = initialDelay;
  }

  setNoDelay(noDelay) {
    if (this._socket) this._socket.setNoDelay(noDelay);
    this._noDelay = noDelay;
  }

  connect(port, host, callback) {
    // resulting TLSSocket extends <net.Socket>
    this._socket = this._tls.connect({ port: port, host: host, rejectUnauthorized: false }, () => {
      // socket.write('{ "id": 5, "method": "blockchain.estimatefee", "params": [2] }\n')
      console.log('TLS Connected to ', host, port);
      return callback();
    });

    // setting everything that was set to this proxy class

    this._socket.setTimeout(this._timeout);
    this._socket.setEncoding(this._encoding);
    this._socket.setKeepAlive(this._keepAliveEneblad, this._keepAliveinitialDelay);
    this._socket.setNoDelay(this._noDelay);

    // resubscribing to events on newly created socket so we could proxy them to already established listeners

    this._socket.on('data', data => {
      super.emit('data', data);
    });
    this._socket.on('end', data => {
      super.emit('end', data);
    });
    this._socket.on('timeout', () => {
      super.emit('timeout');
    });
    this._socket.on('onerror', data => {
      super.emit('onerror', data);
    });
    this._socket.on('error', data => {
      super.emit('error', data);
    });
    this._socket.on('close', data => {
      super.emit('close', data);
    });
    this._socket.on('connect', data => {
      super.emit('connect', data);
    });
    this._socket.on('secureConnect', data => {
      super.emit('secureConnect', data);
    });
    this._socket.on('connection', data => {
      super.emit('connection', data);
    });
  }

  emit(event, data) {
    this._socket.emit(event, data);
  }

  end() {
    this._socket.end();
  }

  destroy() {
    this._socket.destroy();
  }

  write(data) {
    this._socket.write(data);
  }
}

module.exports = TlsSocketWrapper;
