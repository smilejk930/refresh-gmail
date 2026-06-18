const test = require('node:test');
const assert = require('node:assert/strict');
const { SyncEngine } = require('../src/sync/syncEngine');
const { StateStore } = require('../src/sync/stateStore');

function createConfig(mode = 'import') {
  return {
    mode,
    pollIntervalMinutes: 1,
    pop3: {
      host: 'pop.example.com',
      port: 995,
      security: 'tls',
      username: 'me@example.com'
    },
    gmail: {
      credentialsPath: 'credentials.json',
      labelIds: [],
      processForCalendar: true
    },
    sync: {
      maxMessagesPerRun: 10,
      allowMissingMessageIdImport: false
    }
  };
}

function rawMail(id = '<abc@example.com>') {
  return Buffer.from(`Message-ID: ${id}\r\nFrom: a@example.com\r\nSubject: Test\r\nDate: Thu, 18 Jun 2026 10:00:00 +0900\r\n\r\nHello`, 'latin1');
}

class MemoryStateStore extends StateStore {
  constructor() {
    super('unused');
    this.state = { version: 1, accounts: {} };
  }

  read() {
    return this.state;
  }

  write(state) {
    this.state = state;
  }
}

test('verify mode never imports messages', async () => {
  let importCalls = 0;
  const engine = makeEngine({
    config: createConfig('verify'),
    gmail: {
      messageExists: async () => true,
      importMessage: async () => {
        importCalls += 1;
      }
    }
  });

  const summary = await engine.runOnce('test');

  assert.equal(summary.verifiedExists, 1);
  assert.equal(importCalls, 0);
});

test('import mode skips messages already in Gmail and marks UID synced', async () => {
  const stateStore = new MemoryStateStore();
  const engine = makeEngine({
    config: createConfig('import'),
    stateStore,
    gmail: {
      messageExists: async () => true,
      importMessage: async () => {
        throw new Error('must not import');
      }
    }
  });

  const summary = await engine.runOnce('test');

  assert.equal(summary.alreadyInGmail, 1);
  const account = Object.values(stateStore.state.accounts)[0];
  assert.equal(account.syncedUids.uid1.status, 'already_in_gmail');
});

test('import failure does not mark UID as synced', async () => {
  const stateStore = new MemoryStateStore();
  const engine = makeEngine({
    config: createConfig('import'),
    stateStore,
    gmail: {
      messageExists: async () => false,
      importMessage: async () => {
        throw new Error('import failed');
      }
    }
  });

  await assert.rejects(() => engine.runOnce('test'), /import failed/);
  const account = Object.values(stateStore.state.accounts)[0];
  assert.deepEqual(account.syncedUids, {});
});

function makeEngine({ config, gmail, stateStore = new MemoryStateStore() }) {
  return new SyncEngine({
    configProvider: () => ({ ok: true, config, errors: [] }),
    passwordProvider: () => 'secret',
    gmailClientFactory: () => gmail,
    stateStore,
    logger: {
      info() {},
      error() {}
    },
    pop3Factory: () => ({
      connect: async () => {},
      login: async () => {},
      listUids: async () => [{ number: 1, uid: 'uid1' }],
      retrieve: async () => rawMail(),
      quit: async () => {}
    })
  });
}
