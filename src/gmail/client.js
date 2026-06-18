const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { google } = require('googleapis');
const { normalizeMessageIdForSearch } = require('../mail/headers');

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.readonly'
];
const TOKEN_SECRET_KEY = 'gmail.oauthToken';
const LOOPBACK_PORT = 42813;
const LOOPBACK_REDIRECT = `http://127.0.0.1:${LOOPBACK_PORT}/oauth2callback`;

class GmailClient {
  constructor({ credentialsPath, secretStore, shell, googleApi = google }) {
    this.credentialsPath = credentialsPath;
    this.secretStore = secretStore;
    this.shell = shell;
    this.google = googleApi;
    this.oauth2Client = null;
    this.gmail = null;
  }

  async ensureAuthorized() {
    if (this.gmail) {
      return this.gmail;
    }

    this.oauth2Client = this.createOAuthClient();
    const tokenJson = this.secretStore.get(TOKEN_SECRET_KEY);
    if (!tokenJson) {
      throw new Error('Gmail is not authorized. Use the tray menu: Authorize Gmail.');
    }

    this.oauth2Client.setCredentials(JSON.parse(tokenJson));
    this.gmail = this.google.gmail({ version: 'v1', auth: this.oauth2Client });
    return this.gmail;
  }

  async authorizeInteractive() {
    this.oauth2Client = this.createOAuthClient();
    const state = crypto.randomBytes(32).toString('base64url');
    const { codeVerifier, codeChallenge } = await this.oauth2Client.generateCodeVerifierAsync();
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GMAIL_SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const codePromise = waitForOAuthCode({ expectedState: state });
    await this.shell.openExternal(authUrl);
    const code = await codePromise;
    const { tokens } = await this.oauth2Client.getToken({
      code,
      codeVerifier
    });
    this.oauth2Client.setCredentials(tokens);
    this.secretStore.set(TOKEN_SECRET_KEY, JSON.stringify(tokens));
    this.gmail = this.google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  async messageExists(messageId) {
    const gmail = await this.ensureAuthorized();
    const normalized = normalizeMessageIdForSearch(messageId);
    if (!normalized) {
      return false;
    }

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `rfc822msgid:${normalized}`,
      maxResults: 1,
      includeSpamTrash: true
    });

    return Boolean(response.data.messages && response.data.messages.length > 0);
  }

  async importMessage(rawMessage, options = {}) {
    const gmail = await this.ensureAuthorized();
    const requestBody = {};
    if (Array.isArray(options.labelIds) && options.labelIds.length > 0) {
      requestBody.labelIds = options.labelIds;
    }

    const response = await gmail.users.messages.import({
      userId: 'me',
      internalDateSource: 'dateHeader',
      processForCalendar: options.processForCalendar !== false,
      requestBody,
      media: {
        mimeType: 'message/rfc822',
        body: Readable.from([rawMessage])
      }
    });

    return response.data;
  }

  createOAuthClient() {
    const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
    const clientConfig = credentials.installed || credentials.web;
    if (!clientConfig) {
      throw new Error('Gmail credentials file must contain an "installed" or "web" client.');
    }

    return new this.google.auth.OAuth2(
      clientConfig.client_id,
      clientConfig.client_secret,
      LOOPBACK_REDIRECT
    );
  }
}

function waitForOAuthCode({ expectedState }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, LOOPBACK_REDIRECT);
        if (url.pathname !== '/oauth2callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const returnedState = url.searchParams.get('state');
        if (!expectedState || returnedState !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Authorization failed: invalid state.');
          settle(server, reject, new Error('Gmail authorization failed: invalid OAuth state.'));
          return;
        }

        const error = url.searchParams.get('error');
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Authorization failed: ${error}`);
          settle(server, reject, new Error(`Gmail authorization failed: ${error}`));
          return;
        }

        const code = url.searchParams.get('code');
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Missing code.');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Refresh Gmail authorization is complete. You can close this browser tab.');
        settle(server, resolve, code);
      } catch (error) {
        settle(server, reject, error);
      }
    });

    const timeout = setTimeout(() => {
      settle(server, reject, new Error('Timed out waiting for Gmail authorization.'));
    }, 5 * 60 * 1000);

    function settle(serverToClose, complete, value) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      try {
        if (serverToClose.listening) {
          serverToClose.close();
        }
      } catch {
        // The server may already be closed after an auth error or timeout.
      }
      complete(value);
    }

    server.once('error', error => settle(server, reject, error));
    server.listen(LOOPBACK_PORT, '127.0.0.1');
  });
}

module.exports = {
  GmailClient,
  GMAIL_SCOPES,
  TOKEN_SECRET_KEY,
  LOOPBACK_REDIRECT,
  waitForOAuthCode
};
