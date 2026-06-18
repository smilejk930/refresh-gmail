const fs = require('node:fs');
const path = require('node:path');

const VALID_MODES = new Set(['verify', 'import']);
const VALID_SECURITY = new Set(['tls', 'starttls', 'plain']);

function createInitialConfig(configPath) {
  if (fs.existsSync(configPath)) {
    return;
  }

  const initialConfig = {
    mode: 'verify',
    pollIntervalMinutes: null,
    pop3: {
      host: '',
      port: 995,
      security: 'tls',
      username: '',
      rejectUnauthorized: true,
      allowInsecurePlainAuth: false
    },
    gmail: {
      credentialsPath: '',
      labelIds: [],
      processForCalendar: true
    },
    sync: {
      maxMessagesPerRun: 25,
      allowMissingMessageIdImport: false
    }
  };

  fs.writeFileSync(configPath, `${JSON.stringify(initialConfig, null, 2)}\n`, 'utf8');
}

function loadConfig(configPath) {
  createInitialConfig(configPath);

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    return {
      ok: false,
      config: null,
      errors: [`Config JSON is invalid: ${error.message}`]
    };
  }

  return validateConfig(parsed, configPath);
}

function validateConfig(config, configPath = '') {
  const errors = [];

  if (!VALID_MODES.has(config.mode)) {
    errors.push('mode must be "verify" or "import".');
  }

  if (!Number.isInteger(config.pollIntervalMinutes) || config.pollIntervalMinutes < 1) {
    errors.push('pollIntervalMinutes must be an integer greater than or equal to 1.');
  }

  if (!config.pop3 || typeof config.pop3 !== 'object') {
    errors.push('pop3 settings are required.');
  } else {
    if (!nonEmptyString(config.pop3.host)) {
      errors.push('pop3.host is required.');
    }
    if (!Number.isInteger(config.pop3.port) || config.pop3.port < 1 || config.pop3.port > 65535) {
      errors.push('pop3.port must be an integer between 1 and 65535.');
    }
    if (!VALID_SECURITY.has(config.pop3.security)) {
      errors.push('pop3.security must be "tls", "starttls", or "plain".');
    }
    if (config.pop3.security === 'plain' && config.pop3.allowInsecurePlainAuth !== true) {
      errors.push('pop3.security "plain" sends the password without TLS. Set pop3.allowInsecurePlainAuth to true only if you explicitly accept that risk.');
    }
    if (!nonEmptyString(config.pop3.username)) {
      errors.push('pop3.username is required.');
    }
  }

  if (!config.gmail || typeof config.gmail !== 'object') {
    errors.push('gmail settings are required.');
  } else {
    if (!nonEmptyString(config.gmail.credentialsPath)) {
      errors.push('gmail.credentialsPath is required.');
    } else {
      const credentialsPath = resolveConfigPath(config.gmail.credentialsPath, configPath);
      if (configPath && !fs.existsSync(credentialsPath)) {
        errors.push(`gmail.credentialsPath does not exist: ${credentialsPath}`);
      }
    }
    if (config.gmail.labelIds && !Array.isArray(config.gmail.labelIds)) {
      errors.push('gmail.labelIds must be an array when provided.');
    }
  }

  const normalized = normalizeConfig(config, configPath);

  return {
    ok: errors.length === 0,
    config: normalized,
    errors
  };
}

function normalizeConfig(config, configPath = '') {
  return {
    mode: config.mode,
    pollIntervalMinutes: config.pollIntervalMinutes,
    pop3: {
      host: config.pop3?.host || '',
      port: config.pop3?.port || 995,
      security: config.pop3?.security || 'tls',
      username: config.pop3?.username || '',
      rejectUnauthorized: config.pop3?.rejectUnauthorized !== false,
      allowInsecurePlainAuth: config.pop3?.allowInsecurePlainAuth === true,
      timeoutMs: config.pop3?.timeoutMs || 30000
    },
    gmail: {
      credentialsPath: config.gmail?.credentialsPath
        ? resolveConfigPath(config.gmail.credentialsPath, configPath)
        : '',
      labelIds: Array.isArray(config.gmail?.labelIds) ? config.gmail.labelIds : [],
      processForCalendar: config.gmail?.processForCalendar !== false
    },
    sync: {
      maxMessagesPerRun: positiveIntegerOr(config.sync?.maxMessagesPerRun, 25),
      allowMissingMessageIdImport: config.sync?.allowMissingMessageIdImport === true
    }
  };
}

function resolveConfigPath(value, configPath) {
  if (!value || path.isAbsolute(value)) {
    return value;
  }

  const baseDir = configPath ? path.dirname(configPath) : process.cwd();
  return path.resolve(baseDir, value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveIntegerOr(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

module.exports = {
  loadConfig,
  validateConfig,
  normalizeConfig,
  createInitialConfig
};
