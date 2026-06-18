const test = require('node:test');
const assert = require('node:assert/strict');
const { parseUidlLines, unstuffDotLine } = require('../src/pop3/protocol');

test('parseUidlLines parses valid UIDL entries', () => {
  assert.deepEqual(parseUidlLines(['1 abc', '2 xyz-123', 'invalid']), [
    { number: 1, uid: 'abc' },
    { number: 2, uid: 'xyz-123' }
  ]);
});

test('unstuffDotLine removes one stuffed dot only', () => {
  assert.equal(unstuffDotLine('..hello'), '.hello');
  assert.equal(unstuffDotLine('.'), '.');
  assert.equal(unstuffDotLine('hello'), 'hello');
});
