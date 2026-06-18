const crypto = require('node:crypto');

function parseHeaders(rawMessage) {
  const text = Buffer.isBuffer(rawMessage) ? rawMessage.toString('latin1') : String(rawMessage);
  const headerEnd = findHeaderEnd(text);
  const headerText = headerEnd >= 0 ? text.slice(0, headerEnd) : text;
  const unfolded = headerText.replace(/\r?\n[ \t]+/g, ' ');
  const headers = new Map();

  for (const line of unfolded.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) {
      continue;
    }

    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!headers.has(name)) {
      headers.set(name, []);
    }
    headers.get(name).push(value);
  }

  return headers;
}

function findHeaderEnd(text) {
  const crlf = text.indexOf('\r\n\r\n');
  if (crlf >= 0) {
    return crlf;
  }

  return text.indexOf('\n\n');
}

function getHeader(rawMessage, name) {
  const headers = parseHeaders(rawMessage);
  const values = headers.get(name.toLowerCase());
  return values && values.length ? values[0] : null;
}

function getMessageId(rawMessage) {
  return getHeader(rawMessage, 'message-id');
}

function normalizeMessageIdForSearch(messageId) {
  if (!messageId) {
    return null;
  }

  return messageId.trim().replace(/^<+/, '').replace(/>+$/, '');
}

function fingerprint(rawMessage) {
  return crypto.createHash('sha256').update(rawMessage).digest('hex');
}

module.exports = {
  parseHeaders,
  getHeader,
  getMessageId,
  normalizeMessageIdForSearch,
  fingerprint
};
