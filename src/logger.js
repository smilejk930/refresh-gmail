const fs = require('node:fs');

class Logger {
  constructor(logPath) {
    this.logPath = logPath;
  }

  info(message, data) {
    this.write('info', message, data);
  }

  warn(message, data) {
    this.write('warn', message, data);
  }

  error(message, data) {
    this.write('error', message, data);
  }

  write(level, message, data) {
    const entry = {
      at: new Date().toISOString(),
      level,
      message,
      data
    };

    try {
      fs.appendFileSync(this.logPath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch {
      // Logging must never stop mail sync.
    }
  }
}

module.exports = {
  Logger
};
