# Security Notes

## Sensitive Local Files

Do not commit Google OAuth client files, Gmail OAuth tokens, POP3 credentials, generated config, local state, or activity logs. The repository `.gitignore` blocks the expected filenames, but review `git status` before every push.

Blocked examples:

- `credentials*.json`
- `client_secret*.json`
- `token*.json`
- `config.json`
- `state.json`
- `secrets*.json`
- `*.enc.json`
- `activity.log`
- `dist/`
- `node_modules/`

## OAuth

The Gmail OAuth flow uses a loopback redirect with a random `state` value and PKCE. The app requests only:

- `https://www.googleapis.com/auth/gmail.insert`
- `https://www.googleapis.com/auth/gmail.readonly`

## POP3

Use `tls` or `starttls`. Plain POP3 auth is blocked unless `pop3.allowInsecurePlainAuth` is explicitly set to `true`.

## Local Metadata

The sync state stores UIDL values, Gmail IDs, hashes, and status. It avoids storing message subjects or senders by default.
