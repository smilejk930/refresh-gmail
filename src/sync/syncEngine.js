const crypto = require('node:crypto');
const { Pop3Client } = require('../pop3/client');
const { getMessageId, normalizeMessageIdForSearch, fingerprint } = require('../mail/headers');
const { accountKeyFor } = require('./stateStore');

class SyncEngine {
  constructor({
    configProvider,
    passwordProvider,
    gmailClientFactory,
    stateStore,
    logger,
    pop3Factory = options => new Pop3Client(options)
  }) {
    this.configProvider = configProvider;
    this.passwordProvider = passwordProvider;
    this.gmailClientFactory = gmailClientFactory;
    this.stateStore = stateStore;
    this.logger = logger;
    this.pop3Factory = pop3Factory;
  }

  async runOnce(trigger = 'scheduled') {
    const loaded = this.configProvider();
    if (!loaded.ok) {
      throw new Error(`Config is not ready: ${loaded.errors.join(' ')}`);
    }

    const config = loaded.config;
    const accountKey = accountKeyFor(config);
    const summary = createSummary(config.mode, trigger);
    let pop3 = null;

    try {
      const password = this.passwordProvider();
      if (!password) {
        throw new Error('POP3 password is not set. Use the tray menu: Set POP password.');
      }

      const gmailClient = this.gmailClientFactory(config);
      pop3 = this.pop3Factory(config.pop3);
      await pop3.connect();
      await pop3.login(config.pop3.username, password);

      const uidEntries = await pop3.listUids();
      const candidates = uidEntries
        .slice(-config.sync.maxMessagesPerRun)
        .reverse()
        .filter(entry => config.mode === 'verify' || !this.stateStore.hasSynced(accountKey, entry.uid));

      summary.totalOnServer = uidEntries.length;
      summary.checked = candidates.length;

      const verifyResults = [];
      for (const entry of candidates) {
        const result = await this.processMessage({
          config,
          accountKey,
          gmailClient,
          pop3,
          entry
        });

        countResult(summary, result);
        if (config.mode === 'verify') {
          verifyResults.push(result);
        }
      }

      if (config.mode === 'verify') {
        this.stateStore.recordVerifyResults(accountKey, verifyResults);
      }

      this.stateStore.recordRun(accountKey, {
        ...summary,
        ok: true
      });
      this.logger.info('Sync completed.', summary);
      return summary;
    } catch (error) {
      summary.errors += 1;
      summary.errorMessage = error.message;
      this.stateStore.recordRun(accountKey, {
        ...summary,
        ok: false
      });
      this.logger.error('Sync failed.', { error: error.message });
      throw error;
    } finally {
      if (pop3) {
        await pop3.quit();
      }
    }
  }

  async processMessage({ config, accountKey, gmailClient, pop3, entry }) {
    const rawMessage = await pop3.retrieve(entry.number);
    const messageId = getMessageId(rawMessage);
    const normalizedMessageId = normalizeMessageIdForSearch(messageId);

    const base = {
      uid: entry.uid,
      number: entry.number,
      hasMessageId: Boolean(messageId),
      messageIdHash: normalizedMessageId ? hashText(normalizedMessageId) : null,
      fingerprint: fingerprint(rawMessage)
    };

    if (!messageId && !config.sync.allowMissingMessageIdImport) {
      return {
        ...base,
        action: 'skipped_missing_message_id'
      };
    }

    const exists = messageId ? await gmailClient.messageExists(messageId) : false;
    if (config.mode === 'verify') {
      return {
        ...base,
        action: exists ? 'verified_exists' : 'verified_missing'
      };
    }

    if (exists) {
      this.stateStore.markSynced(accountKey, entry.uid, {
        status: 'already_in_gmail',
        messageIdHash: base.messageIdHash,
        fingerprint: base.fingerprint
      });
      return {
        ...base,
        action: 'already_in_gmail'
      };
    }

    const imported = await gmailClient.importMessage(rawMessage, {
      labelIds: config.gmail.labelIds,
      processForCalendar: config.gmail.processForCalendar
    });

    this.stateStore.markSynced(accountKey, entry.uid, {
      status: 'imported',
      gmailId: imported.id,
      threadId: imported.threadId,
      messageIdHash: base.messageIdHash,
      fingerprint: base.fingerprint
    });

    return {
      ...base,
      action: 'imported',
      gmailId: imported.id
    };
  }
}

function createSummary(mode, trigger) {
  return {
    mode,
    trigger,
    startedAt: new Date().toISOString(),
    totalOnServer: 0,
    checked: 0,
    imported: 0,
    alreadyInGmail: 0,
    verifiedExists: 0,
    verifiedMissing: 0,
    skippedMissingMessageId: 0,
    errors: 0
  };
}

function countResult(summary, result) {
  if (result.action === 'imported') {
    summary.imported += 1;
  } else if (result.action === 'already_in_gmail') {
    summary.alreadyInGmail += 1;
  } else if (result.action === 'verified_exists') {
    summary.verifiedExists += 1;
  } else if (result.action === 'verified_missing') {
    summary.verifiedMissing += 1;
  } else if (result.action === 'skipped_missing_message_id') {
    summary.skippedMissingMessageId += 1;
  }
}

function hashText(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

module.exports = {
  SyncEngine
};
