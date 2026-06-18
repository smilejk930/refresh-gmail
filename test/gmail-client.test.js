const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { GmailClient, GMAIL_SCOPES, LOOPBACK_REDIRECT } = require('../src/gmail/client');

test('Gmail scopes are limited to insert and readonly', () => {
  assert.deepEqual(GMAIL_SCOPES, [
    'https://www.googleapis.com/auth/gmail.insert',
    'https://www.googleapis.com/auth/gmail.readonly'
  ]);
});

test('messageExists searches Gmail by rfc822 message id', async () => {
  const calls = [];
  const client = createClient({
    gmail: {
      users: {
        messages: {
          list: async params => {
            calls.push(params);
            return { data: { messages: [{ id: 'gmail-id' }] } };
          }
        }
      }
    }
  });

  const exists = await client.messageExists('<abc@example.com>');

  assert.equal(exists, true);
  assert.equal(calls[0].q, 'rfc822msgid:abc@example.com');
  assert.equal(calls[0].includeSpamTrash, true);
});

test('importMessage uses Gmail messages.import with dateHeader', async () => {
  const calls = [];
  const client = createClient({
    gmail: {
      users: {
        messages: {
          import: async params => {
            calls.push(params);
            return { data: { id: 'imported-id', threadId: 'thread-id' } };
          }
        }
      }
    }
  });

  const imported = await client.importMessage(Buffer.from('Message-ID: <abc@example.com>\r\n\r\nHi'), {
    labelIds: ['Label_1'],
    processForCalendar: false
  });

  assert.equal(imported.id, 'imported-id');
  assert.equal(calls[0].userId, 'me');
  assert.equal(calls[0].internalDateSource, 'dateHeader');
  assert.equal(calls[0].processForCalendar, false);
  assert.deepEqual(calls[0].requestBody.labelIds, ['Label_1']);
  assert.equal(calls[0].media.mimeType, 'message/rfc822');
});

test('authorizeInteractive uses state and PKCE before storing tokens', async () => {
  let authOptions;
  let tokenOptions;
  let storedToken;

  function OAuth2() {
    this.generateCodeVerifierAsync = async () => ({
      codeVerifier: 'verifier-123',
      codeChallenge: 'challenge-456'
    });
    this.generateAuthUrl = options => {
      authOptions = options;
      const url = new URL('https://accounts.example.test/auth');
      for (const [key, value] of Object.entries(options)) {
        if (Array.isArray(value)) {
          url.searchParams.set(key, value.join(' '));
        } else {
          url.searchParams.set(key, value);
        }
      }
      return url.toString();
    };
    this.getToken = async options => {
      tokenOptions = options;
      return { tokens: { refresh_token: 'new-refresh-token' } };
    };
    this.setCredentials = () => {};
  }

  const client = createClient({
    gmail: {
      users: {
        messages: {}
      }
    },
    OAuth2,
    secretStore: {
      get: () => null,
      set: (_key, value) => {
        storedToken = value;
      }
    },
    shell: {
      openExternal: async authUrl => {
        const state = new URL(authUrl).searchParams.get('state');
        await requestOAuthCallback(`/oauth2callback?code=code-789&state=${encodeURIComponent(state)}`);
      }
    }
  });

  await client.authorizeInteractive();

  assert.equal(authOptions.code_challenge, 'challenge-456');
  assert.equal(authOptions.code_challenge_method, 'S256');
  assert.ok(authOptions.state);
  assert.deepEqual(authOptions.scope, GMAIL_SCOPES);
  assert.deepEqual(tokenOptions, {
    code: 'code-789',
    codeVerifier: 'verifier-123'
  });
  assert.equal(JSON.parse(storedToken).refresh_token, 'new-refresh-token');
});

function createClient({
  gmail,
  OAuth2 = function OAuth2() {
    this.setCredentials = () => {};
  },
  secretStore = {
    get: () => JSON.stringify({ refresh_token: 'refresh-token' })
  },
  shell = {
    openExternal: async () => {}
  }
}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-gmail-test-'));
  const credentialsPath = path.join(tempDir, 'credentials.json');
  fs.writeFileSync(credentialsPath, JSON.stringify({
    installed: {
      client_id: 'client-id',
      client_secret: 'client-secret'
    }
  }));

  return new GmailClient({
    credentialsPath,
    secretStore,
    shell,
    googleApi: {
      auth: { OAuth2 },
      gmail: () => gmail
    }
  });
}

function requestOAuthCallback(pathname) {
  const url = new URL(LOOPBACK_REDIRECT);
  url.pathname = pathname.split('?')[0];
  url.search = pathname.includes('?') ? pathname.slice(pathname.indexOf('?')) : '';

  return new Promise((resolve, reject) => {
    let attempts = 0;

    function attempt() {
      attempts += 1;
      const req = http.get(url, res => {
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', error => {
        if (attempts < 25 && error.code === 'ECONNREFUSED') {
          setTimeout(attempt, 20);
          return;
        }
        reject(error);
      });
    }

    attempt();
  });
}
