const fs = require('node:fs');

class SecretStore {
  constructor({ safeStorage, secretsPath }) {
    this.safeStorage = safeStorage;
    this.secretsPath = secretsPath;
  }

  get(key) {
    const values = this.readAll();
    if (!values[key]) {
      return null;
    }

    if (!this.safeStorage.isEncryptionAvailable()) {
      throw new Error('OS encryption is not available for safe secret storage.');
    }

    const encrypted = Buffer.from(values[key], 'base64');
    return this.safeStorage.decryptString(encrypted);
  }

  set(key, value) {
    if (!this.safeStorage.isEncryptionAvailable()) {
      throw new Error('OS encryption is not available for safe secret storage.');
    }

    const values = this.readAll();
    values[key] = this.safeStorage.encryptString(value).toString('base64');
    this.writeAll(values);
  }

  delete(key) {
    const values = this.readAll();
    delete values[key];
    this.writeAll(values);
  }

  readAll() {
    if (!fs.existsSync(this.secretsPath)) {
      return {};
    }

    try {
      return JSON.parse(fs.readFileSync(this.secretsPath, 'utf8'));
    } catch {
      return {};
    }
  }

  writeAll(values) {
    const tempPath = `${this.secretsPath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(values, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, this.secretsPath);
  }
}

module.exports = {
  SecretStore
};
