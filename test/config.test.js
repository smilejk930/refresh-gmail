const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConfig } = require('../src/config');

test('config requires an explicit poll interval', () => {
  const result = validateConfig({
    mode: 'verify',
    pollIntervalMinutes: null,
    pop3: {
      host: 'pop.example.com',
      port: 995,
      security: 'tls',
      username: 'me@example.com'
    },
    gmail: {
      credentialsPath: 'credentials.json'
    }
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /pollIntervalMinutes/);
});

test('config accepts 1 minute polling and import mode', () => {
  const result = validateConfig({
    mode: 'import',
    pollIntervalMinutes: 1,
    pop3: {
      host: 'pop.example.com',
      port: 995,
      security: 'tls',
      username: 'me@example.com'
    },
    gmail: {
      credentialsPath: 'credentials.json'
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.pollIntervalMinutes, 1);
});

test('config blocks plain POP3 unless explicitly acknowledged', () => {
  const result = validateConfig({
    mode: 'import',
    pollIntervalMinutes: 1,
    pop3: {
      host: 'pop.example.com',
      port: 110,
      security: 'plain',
      username: 'me@example.com'
    },
    gmail: {
      credentialsPath: 'credentials.json'
    }
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /allowInsecurePlainAuth/);
});

test('config allows plain POP3 only with explicit insecure opt-in', () => {
  const result = validateConfig({
    mode: 'import',
    pollIntervalMinutes: 1,
    pop3: {
      host: 'pop.example.com',
      port: 110,
      security: 'plain',
      username: 'me@example.com',
      allowInsecurePlainAuth: true
    },
    gmail: {
      credentialsPath: 'credentials.json'
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.pop3.allowInsecurePlainAuth, true);
});
