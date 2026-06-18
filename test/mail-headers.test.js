const test = require('node:test');
const assert = require('node:assert/strict');
const { getHeader, getMessageId, normalizeMessageIdForSearch } = require('../src/mail/headers');

test('headers are parsed case-insensitively with folded lines', () => {
  const raw = Buffer.from('Message-ID: <abc@example.com>\r\nSubject: Hello\r\n world\r\n\r\nBody', 'latin1');

  assert.equal(getMessageId(raw), '<abc@example.com>');
  assert.equal(getHeader(raw, 'subject'), 'Hello world');
});

test('normalizeMessageIdForSearch removes angle brackets', () => {
  assert.equal(normalizeMessageIdForSearch('<abc@example.com>'), 'abc@example.com');
});
