# Refresh Gmail

[한국어 README](README.ko.md)

Refresh Gmail is a Windows tray app that checks a POP3 mailbox on your schedule and imports new messages into Gmail with the Gmail API. It does not depend on Gmail's built-in "Check mail from other accounts" POP fetcher.

## How It Works

- `verify` mode connects to POP3, reads recent message headers, and checks whether each `Message-ID` already exists in Gmail. It never imports mail.
- `import` mode retrieves unsynced POP3 messages, searches Gmail with `rfc822msgid:<Message-ID>`, and imports only messages that are not already present.
- POP3 messages are never deleted from the company mail server.
- POP3 UIDLs are stored locally only after Gmail already has the message or after Gmail import succeeds.

## Setup

1. In Google Cloud Console, create an OAuth Desktop client and download `credentials.json`.
2. Enable the Gmail API for the Google Cloud project.
3. Start the app with `cmd /c npm start`.
4. Use the tray menu to set the POP password and authorize Gmail.
5. Open the config folder from the tray menu and edit `%APPDATA%\\refresh-gmail\\config.json`.
6. Start with `"mode": "verify"` while Gmail's old POP fetcher is still enabled.
7. After verification looks right, remove Gmail's old POP fetcher and change `"mode": "import"`.

## Configuration

The app reads `%APPDATA%\\refresh-gmail\\config.json`. See `config.example.json` for the full shape.

Required values:

- `mode`: `verify` or `import`
- `pollIntervalMinutes`: integer `>= 1`
- `pop3.host`
- `pop3.port`
- `pop3.security`: `tls`, `starttls`, or `plain`
- `pop3.username`
- `gmail.credentialsPath`

Secrets are not stored in this JSON file. Gmail OAuth tokens and the POP3 password are encrypted with Electron `safeStorage` under `%APPDATA%\\refresh-gmail`.

Use `tls` or `starttls` for POP3. The app blocks `plain` POP3 authentication unless `pop3.allowInsecurePlainAuth` is explicitly set to `true`, because `plain` sends the mailbox password without TLS.

The Gmail OAuth scopes are limited to importing messages and searching existing messages:

- `https://www.googleapis.com/auth/gmail.insert`
- `https://www.googleapis.com/auth/gmail.readonly`

## GitHub Safety

Do not commit local runtime files or Google OAuth downloads. `.gitignore` excludes the common sensitive names:

- `credentials*.json`
- `client_secret*.json`
- `token*.json`
- `config.json`
- `state.json`
- `secrets*.json`
- `*.enc.json`
- `activity.log`

The packaged EXE under `dist/` is also ignored. Publish it as a GitHub Release asset if needed.

## Development

```powershell
cmd /c npm install
cmd /c npm test
cmd /c npm start
cmd /c npm run package
```

PowerShell may block `npm.ps1`, so use `cmd /c npm ...` on Windows.
