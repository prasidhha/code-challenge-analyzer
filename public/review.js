function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function init() {
  const user = await loadUser('reviewer');
  if (!user) return;
  renderShell(user, 'submissions');

  const sessionId = new URLSearchParams(window.location.search).get('session');
  if (!sessionId) {
    document.getElementById('metrics').innerHTML = '<p class="error">No session specified</p>';
    return;
  }

  const res = await fetch(`/api/sessions/${sessionId}/history`);
  if (!res.ok) {
    document.getElementById('metrics').innerHTML = '<p class="error">Could not load this session</p>';
    return;
  }
  const h = await res.json();

  renderMetrics(h);
  renderTimeline(h.timeline);
  renderDiff(h.diff);
}

function renderMetrics(h) {
  const first = h.timeline[0];
  const last = h.timeline[h.timeline.length - 1];
  const improvement = first && last ? last.passed - first.passed : 0;

  let duration = '—';
  if (first && last) {
    const mins = Math.round((new Date(last.createdAt) - new Date(first.createdAt)) / 60000);
    duration = `${mins} min`;
  }

  document.getElementById('metrics').innerHTML = `
    <h2>Approach summary</h2>
    <div class="metric-grid">
      <div class="metric"><span class="metric-value">${h.runCount}</span><span class="metric-label">Runs</span></div>
      <div class="metric"><span class="metric-value">${h.diff ? h.diff.changed : 0}</span><span class="metric-label">Lines changed</span></div>
      <div class="metric"><span class="metric-value">${last ? last.passed + '/' + last.total : '—'}</span><span class="metric-label">Final score</span></div>
      <div class="metric"><span class="metric-value">${improvement >= 0 ? '+' : ''}${improvement}</span><span class="metric-label">Improvement</span></div>
      <div class="metric"><span class="metric-value">${duration}</span><span class="metric-label">Duration</span></div>
    </div>`;
}

function renderTimeline(timeline) {
  document.getElementById('timeline').innerHTML = `
    <h2>Approach evolution</h2>
    <table class="session-table">
      <thead><tr><th>Run</th><th>Score</th><th>Lines changed</th><th>Time</th></tr></thead>
      <tbody>
        ${timeline.map(t => `
          <tr>
            <td>${t.runNumber}</td>
            <td>${t.passed}/${t.total}</td>
            <td>${t.changedFromOriginal}</td>
            <td>${new Date(t.createdAt).toLocaleTimeString()}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderDiff(diff) {
  if (!diff) {
    document.getElementById('diff').innerHTML = '<h2>Changes</h2><p class="muted">No submissions yet</p>';
    return;
  }

  document.getElementById('diff').innerHTML = `
    <h2>Changes <span class="muted">(+${diff.added} / −${diff.removed})</span></h2>
    <div class="diff">
      ${diff.lines.map(l => `
        <div class="diff-line ${l.type}">
          <span class="diff-sign">${l.type === 'added' ? '+' : l.type === 'removed' ? '−' : ' '}</span>
          <code>${escapeHtml(l.text)}</code>
        </div>`).join('')}
    </div>`;
}

init();