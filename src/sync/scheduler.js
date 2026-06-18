class Scheduler {
  constructor({ runSync, loadConfig, onStatus }) {
    this.runSync = runSync;
    this.loadConfig = loadConfig;
    this.onStatus = onStatus;
    this.timer = null;
    this.running = false;
    this.paused = false;
  }

  start() {
    this.stop();
    const loaded = this.loadConfig();
    if (!loaded.ok) {
      this.onStatus({
        state: 'config-error',
        message: loaded.errors.join(' ')
      });
      return;
    }

    const intervalMs = loaded.config.pollIntervalMinutes * 60 * 1000;
    this.timer = setInterval(() => {
      this.runNow('scheduled');
    }, intervalMs);
    this.onStatus({
      state: 'scheduled',
      message: `Every ${loaded.config.pollIntervalMinutes} minute(s), mode=${loaded.config.mode}`
    });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setPaused(paused) {
    this.paused = paused;
    this.onStatus({
      state: paused ? 'paused' : 'scheduled',
      message: paused ? 'Paused' : 'Resumed'
    });
  }

  async runNow(trigger = 'manual') {
    if (this.paused) {
      this.onStatus({
        state: 'paused',
        message: 'Sync is paused.'
      });
      return null;
    }

    if (this.running) {
      this.onStatus({
        state: 'busy',
        message: 'Sync is already running.'
      });
      return null;
    }

    this.running = true;
    this.onStatus({
      state: 'running',
      message: 'Checking POP3 mailbox...'
    });

    try {
      const summary = await this.runSync(trigger);
      this.onStatus({
        state: 'ok',
        message: formatSummary(summary)
      });
      return summary;
    } catch (error) {
      this.onStatus({
        state: 'error',
        message: error.message
      });
      return null;
    } finally {
      this.running = false;
    }
  }
}

function formatSummary(summary) {
  if (summary.mode === 'verify') {
    return `Verify done: ${summary.verifiedExists} existing, ${summary.verifiedMissing} missing, ${summary.skippedMissingMessageId} skipped.`;
  }

  return `Import done: ${summary.imported} imported, ${summary.alreadyInGmail} already present, ${summary.skippedMissingMessageId} skipped.`;
}

module.exports = {
  Scheduler,
  formatSummary
};
