const net = require('node:net');
const tls = require('node:tls');
const { assertPositiveResponse, parseUidlLines, unstuffDotLine } = require('./protocol');

class Pop3Client {
  constructor(options) {
    this.options = {
      timeoutMs: 30000,
      rejectUnauthorized: true,
      ...options
    };
    this.socket = null;
    this.buffer = '';
    this.waiters = [];
    this.closed = false;
  }

  async connect() {
    const { host, port, security, timeoutMs, rejectUnauthorized } = this.options;

    this.socket = await createSocket({
      host,
      port,
      security,
      timeoutMs,
      rejectUnauthorized
    });
    this.attachSocket(this.socket);

    const greeting = await this.readLine();
    assertPositiveResponse(greeting, 'CONNECT');

    if (security === 'starttls') {
      await this.commandSingle('STLS');
      this.detachSocket();
      this.socket = tls.connect({
        socket: this.socket,
        servername: host,
        rejectUnauthorized
      });
      await onceSecureConnect(this.socket, timeoutMs);
      this.attachSocket(this.socket);
    }
  }

  async login(username, password) {
    await this.commandSingle(`USER ${username}`);
    await this.commandSingle(`PASS ${password}`);
  }

  async listUids() {
    const lines = await this.commandMultiline('UIDL');
    return parseUidlLines(lines);
  }

  async retrieve(messageNumber) {
    const lines = await this.commandMultiline(`RETR ${messageNumber}`);
    return Buffer.from(`${lines.join('\r\n')}\r\n`, 'latin1');
  }

  async quit() {
    if (!this.socket || this.closed) {
      return;
    }

    try {
      await this.commandSingle('QUIT');
    } catch {
      // The socket may close before QUIT returns. That is fine for shutdown.
    } finally {
      this.socket.end();
    }
  }

  destroy() {
    if (this.socket && !this.closed) {
      this.socket.destroy();
    }
  }

  async commandSingle(command) {
    this.writeLine(command);
    const line = await this.readLine();
    assertPositiveResponse(line, command);
    return line;
  }

  async commandMultiline(command) {
    this.writeLine(command);
    const status = await this.readLine();
    assertPositiveResponse(status, command);

    const lines = [];
    while (true) {
      const line = await this.readLine();
      if (line === '.') {
        break;
      }
      lines.push(unstuffDotLine(line));
    }

    return lines;
  }

  attachSocket(socket) {
    this.closed = false;
    socket.setEncoding('latin1');
    socket.on('data', chunk => {
      this.buffer += chunk;
      this.drainWaiters();
    });
    socket.on('close', () => {
      this.closed = true;
      this.rejectWaiters(new Error('POP3 connection closed.'));
    });
    socket.on('error', error => {
      this.rejectWaiters(error);
    });
  }

  detachSocket() {
    if (!this.socket) {
      return;
    }

    this.socket.removeAllListeners('data');
    this.socket.removeAllListeners('close');
    this.socket.removeAllListeners('error');
    this.buffer = '';
    this.waiters = [];
  }

  writeLine(line) {
    if (!this.socket || this.closed) {
      throw new Error('POP3 connection is not open.');
    }
    this.socket.write(`${line}\r\n`, 'latin1');
  }

  readLine() {
    const existing = this.shiftLine();
    if (existing !== null) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject };
      waiter.timeout = setTimeout(() => {
        this.waiters = this.waiters.filter(item => item !== waiter);
        reject(new Error('Timed out waiting for POP3 response.'));
      }, this.options.timeoutMs);

      this.waiters.push(waiter);
    });
  }

  drainWaiters() {
    while (this.waiters.length > 0) {
      const line = this.shiftLine();
      if (line === null) {
        return;
      }

      const waiter = this.waiters.shift();
      clearTimeout(waiter.timeout);
      waiter.resolve(line);
    }
  }

  rejectWaiters(error) {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
    this.waiters = [];
  }

  shiftLine() {
    const index = this.buffer.indexOf('\r\n');
    if (index < 0) {
      return null;
    }

    const line = this.buffer.slice(0, index);
    this.buffer = this.buffer.slice(index + 2);
    return line;
  }
}

function createSocket({ host, port, security, timeoutMs, rejectUnauthorized }) {
  return new Promise((resolve, reject) => {
    const socket = security === 'tls'
      ? tls.connect({ host, port, servername: host, rejectUnauthorized })
      : net.connect({ host, port });

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('Timed out opening POP3 connection.'));
    }, timeoutMs);

    const eventName = security === 'tls' ? 'secureConnect' : 'connect';
    socket.once(eventName, () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function onceSecureConnect(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('Timed out upgrading POP3 connection to TLS.'));
    }, timeoutMs);

    socket.once('secureConnect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

module.exports = {
  Pop3Client
};
