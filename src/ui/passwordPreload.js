const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('refreshGmail', {
  submitPopPassword(value) {
    ipcRenderer.send('pop-password-submitted', String(value || ''));
  }
});
