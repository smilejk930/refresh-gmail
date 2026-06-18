const { Menu, Tray, dialog, nativeImage, shell, app } = require('electron');
const { promptPassword } = require('./ui/passwordPrompt');

const POP_PASSWORD_KEY = 'pop3.password';

class TrayController {
  constructor({ scheduler, secretStore, loadConfig, gmailClientFactory, paths }) {
    this.scheduler = scheduler;
    this.secretStore = secretStore;
    this.loadConfig = loadConfig;
    this.gmailClientFactory = gmailClientFactory;
    this.paths = paths;
    this.status = {
      state: 'starting',
      message: 'Starting...'
    };
    this.tray = new Tray(createTrayImage());
    this.tray.setToolTip('Refresh Gmail');
    this.renderMenu();
  }

  setStatus(status) {
    this.status = status;
    this.tray.setToolTip(`Refresh Gmail - ${status.message}`);
    this.renderMenu();
  }

  renderMenu() {
    const loginSettings = app.getLoginItemSettings();
    const menu = Menu.buildFromTemplate([
      {
        label: `Status: ${this.status.message}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Sync now',
        click: () => this.scheduler.runNow('manual')
      },
      {
        label: this.scheduler.paused ? 'Resume' : 'Pause',
        click: () => this.scheduler.setPaused(!this.scheduler.paused)
      },
      {
        label: 'Reload schedule',
        click: () => this.scheduler.start()
      },
      { type: 'separator' },
      {
        label: 'Set POP password',
        click: () => this.setPopPassword()
      },
      {
        label: 'Authorize Gmail',
        click: () => this.authorizeGmail()
      },
      {
        label: 'Open config folder',
        click: () => shell.openPath(this.paths.baseDir)
      },
      {
        label: 'Open activity log',
        click: () => shell.openPath(this.paths.logPath)
      },
      { type: 'separator' },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: loginSettings.openAtLogin,
        click: item => {
          app.setLoginItemSettings({
            openAtLogin: item.checked,
            path: process.execPath
          });
        }
      },
      {
        label: 'Quit',
        click: () => app.quit()
      }
    ]);

    this.tray.setContextMenu(menu);
  }

  async setPopPassword() {
    const password = await promptPassword();
    if (!password) {
      return;
    }

    try {
      this.secretStore.set(POP_PASSWORD_KEY, password);
      dialog.showMessageBox({
        type: 'info',
        message: 'POP password was saved.'
      });
    } catch (error) {
      dialog.showErrorBox('Could not save POP password', error.message);
    }
  }

  async authorizeGmail() {
    const loaded = this.loadConfig();
    if (!loaded.ok) {
      dialog.showErrorBox('Config is not ready', loaded.errors.join('\n'));
      return;
    }

    try {
      const gmailClient = this.gmailClientFactory(loaded.config);
      await gmailClient.authorizeInteractive();
      dialog.showMessageBox({
        type: 'info',
        message: 'Gmail authorization is complete.'
      });
    } catch (error) {
      dialog.showErrorBox('Gmail authorization failed', error.message);
    }
  }
}

function createTrayImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <rect width="16" height="16" rx="3" fill="#1a73e8"/>
    <path d="M3 5.2 8 8.9l5-3.7V12H3V5.2Z" fill="#fff"/>
    <path d="M3.5 4h9L8 7.35 3.5 4Z" fill="#d2e3fc"/>
  </svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

module.exports = {
  TrayController,
  POP_PASSWORD_KEY
};
