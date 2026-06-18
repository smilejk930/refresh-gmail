const path = require('node:path');
const { BrowserWindow, ipcMain } = require('electron');

function promptPassword(parent) {
  return new Promise(resolve => {
    const win = new BrowserWindow({
      parent,
      modal: true,
      width: 420,
      height: 190,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: 'Set POP Password',
      webPreferences: {
        preload: path.join(__dirname, 'passwordPreload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    win.setMenu(null);
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html())}`);

    const handler = (_event, value) => {
      ipcMain.removeListener('pop-password-submitted', handler);
      if (!win.isDestroyed()) {
        win.close();
      }
      resolve(value || null);
    };

    ipcMain.on('pop-password-submitted', handler);
    win.on('closed', () => {
      ipcMain.removeListener('pop-password-submitted', handler);
      resolve(null);
    });
  });
}

function html() {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: "Segoe UI", sans-serif; margin: 20px; color: #202124; }
      label { display: block; font-size: 13px; margin-bottom: 8px; }
      input { box-sizing: border-box; width: 100%; font-size: 14px; padding: 8px; }
      .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
      button { font-size: 13px; padding: 7px 14px; }
    </style>
  </head>
  <body>
    <form id="form">
      <label for="password">POP3 password</label>
      <input id="password" type="password" autofocus autocomplete="current-password">
      <div class="actions">
        <button type="button" id="cancel">Cancel</button>
        <button type="submit">Save</button>
      </div>
    </form>
    <script>
      const input = document.getElementById('password');
      document.getElementById('cancel').addEventListener('click', () => window.close());
      document.getElementById('form').addEventListener('submit', event => {
        event.preventDefault();
        window.refreshGmail.submitPopPassword(input.value);
      });
    </script>
  </body>
</html>`;
}

module.exports = {
  promptPassword
};
