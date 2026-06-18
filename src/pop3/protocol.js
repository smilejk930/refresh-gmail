function assertPositiveResponse(line, command) {
  if (typeof line !== 'string' || !line.startsWith('+OK')) {
    throw new Error(`${command} failed: ${line || 'empty response'}`);
  }
}

function parseUidlLines(lines) {
  const entries = [];

  for (const line of lines) {
    const match = /^(\d+)\s+(.+)$/.exec(line.trim());
    if (!match) {
      continue;
    }

    entries.push({
      number: Number.parseInt(match[1], 10),
      uid: match[2]
    });
  }

  return entries;
}

function unstuffDotLine(line) {
  return line.startsWith('..') ? line.slice(1) : line;
}

module.exports = {
  assertPositiveResponse,
  parseUidlLines,
  unstuffDotLine
};
