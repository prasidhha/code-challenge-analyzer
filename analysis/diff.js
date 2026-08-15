const Diff = require('diff');

function computeDiff(original, current) {
  const parts = Diff.diffLines(original || '', current || '');
  const lines = [];

  for (const part of parts) {
    const type = part.added ? 'added' : part.removed ? 'removed' : 'unchanged';
    for (const text of part.value.split('\n')) {
      if (text !== '' || type !== 'unchanged') {
        lines.push({ type, text });
      }
    }
  }

  const added = lines.filter(l => l.type === 'added').length;
  const removed = lines.filter(l => l.type === 'removed').length;

  return { lines, added, removed, changed: added + removed };
}

module.exports = { computeDiff };