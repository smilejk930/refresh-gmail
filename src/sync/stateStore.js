const crypto = require('node:crypto');
const fs = require('node:fs');

class StateStore {
  constructor(statePath) {
    this.statePath = statePath;
  }

  read() {
    if (!fs.existsSync(this.statePath)) {
      return emptyState();
    }

    try {
      return {
        ...emptyState(),
        ...JSON.parse(fs.readFileSync(this.statePath, 'utf8'))
      };
    } catch {
      return emptyState();
    }
  }

  write(state) {
    const tempPath = `${this.statePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, this.statePath);
  }

  getAccountState(accountKey) {
    const state = this.read();
    state.accounts[accountKey] ||= {
      syncedUids: {},
      verifyResults: [],
      lastRun: null
    };
    return {
      fullState: state,
      accountState: state.accounts[accountKey]
    };
  }

  markSynced(accountKey, uid, details) {
    const { fullState, accountState } = this.getAccountState(accountKey);
    accountState.syncedUids[uid] = {
      ...details,
      syncedAt: new Date().toISOString()
    };
    this.write(fullState);
  }

  hasSynced(accountKey, uid) {
    const { accountState } = this.getAccountState(accountKey);
    return Boolean(accountState.syncedUids[uid]);
  }

  recordVerifyResults(accountKey, results) {
    const { fullState, accountState } = this.getAccountState(accountKey);
    accountState.verifyResults = results.slice(0, 50);
    accountState.lastVerifyAt = new Date().toISOString();
    this.write(fullState);
  }

  recordRun(accountKey, summary) {
    const { fullState, accountState } = this.getAccountState(accountKey);
    accountState.lastRun = {
      ...summary,
      finishedAt: new Date().toISOString()
    };
    this.write(fullState);
  }
}

function accountKeyFor(config) {
  const source = `${config.pop3.host}|${config.pop3.port}|${config.pop3.username}`;
  return crypto.createHash('sha256').update(source).digest('hex').slice(0, 24);
}

function emptyState() {
  return {
    version: 1,
    accounts: {}
  };
}

module.exports = {
  StateStore,
  accountKeyFor,
  emptyState
};
