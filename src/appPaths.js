const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function getBaseDir() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'refresh-gmail');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getPaths() {
  const baseDir = getBaseDir();
  ensureDir(baseDir);

  return {
    baseDir,
    configPath: path.join(baseDir, 'config.json'),
    statePath: path.join(baseDir, 'state.json'),
    secretsPath: path.join(baseDir, 'secrets.enc.json'),
    logPath: path.join(baseDir, 'activity.log')
  };
}

module.exports = {
  getBaseDir,
  getPaths,
  ensureDir
};
