const { app, dialog, safeStorage, shell } = require('electron');
const { getPaths } = require('./appPaths');
const { loadConfig } = require('./config');
const { GmailClient } = require('./gmail/client');
const { Logger } = require('./logger');
const { SecretStore } = require('./secretStore');
const { StateStore } = require('./sync/stateStore');
const { Scheduler } = require('./sync/scheduler');
const { SyncEngine } = require('./sync/syncEngine');
const { TrayController, POP_PASSWORD_KEY } = require('./tray');

let trayController;
let scheduler;

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (trayController) {
      dialog.showMessageBox({
        type: 'info',
        message: 'Refresh Gmail is already running in the tray.'
      });
    }
  });

  app.whenReady().then(() => {
    const paths = getPaths();
    const logger = new Logger(paths.logPath);
    const secretStore = new SecretStore({
      safeStorage,
      secretsPath: paths.secretsPath
    });
    const stateStore = new StateStore(paths.statePath);
    const configProvider = () => loadConfig(paths.configPath);
    const gmailClientFactory = config => new GmailClient({
      credentialsPath: config.gmail.credentialsPath,
      secretStore,
      shell
    });

    const engine = new SyncEngine({
      configProvider,
      passwordProvider: () => secretStore.get(POP_PASSWORD_KEY),
      gmailClientFactory,
      stateStore,
      logger
    });

    scheduler = new Scheduler({
      runSync: trigger => engine.runOnce(trigger),
      loadConfig: configProvider,
      onStatus: status => trayController?.setStatus(status)
    });

    trayController = new TrayController({
      scheduler,
      secretStore,
      loadConfig: configProvider,
      gmailClientFactory,
      paths
    });

    scheduler.start();
  });
}

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  if (scheduler) {
    scheduler.stop();
  }
});
