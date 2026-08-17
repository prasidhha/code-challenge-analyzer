let editor = null;
let sessionId = null;
let currentProblem = null;

async function init() {
  const user = await loadUser('candidate');
  if (!user) return;
  renderShell(user, 'compiler');

  const res = await fetch('/api/problems');
  const problems = await res.json();

  const list = document.getElementById('problem-list');
  list.innerHTML = problems.map(p =>
    `<div class="problem-row" data-id="${p.id}">
       <span>${p.title}</span><span class="status">InProgress</span>
     </div>`
  ).join('');

  list.querySelectorAll('.problem-row').forEach(row => {
    row.addEventListener('click', () => openProblem(Number(row.dataset.id)));
  });
}

async function openProblem(id) {
  const res = await fetch(`/api/problems/${id}`);
  currentProblem = await res.json();

  const sres = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problemId: id })
  });
  const session = await sres.json();
  sessionId = session.sessionId;

  document.getElementById('problem-list').classList.add('hidden');
  document.getElementById('workspace').classList.remove('hidden');
  document.getElementById('problem-title').textContent = currentProblem.title;
  document.getElementById('problem-statement').textContent = currentProblem.statement;
  document.getElementById('lang-label').textContent = currentProblem.language;

  if (!editor) {
    editor = CodeMirror.fromTextArea(document.getElementById('code'), {
      mode: 'python', lineNumbers: true, indentUnit: 4
    });
  }
  editor.setValue(currentProblem.starterCode);
}

async function run() {
  const btn = document.getElementById('run');
  const results = document.getElementById('results');
  btn.disabled = true;
  results.innerHTML = '<p class="muted">Running...</p>';

  try {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, problemId: currentProblem.id, code: editor.getValue() })
    });
    const data = await res.json();

    if (!res.ok) {
      results.innerHTML = `<p class="error">${data.error}</p>`;
      return;
    }
    renderResults(data);
  } finally {
    btn.disabled = false;
  }
}

function renderResults(data) {
  const pct = Math.round((data.passed / data.total) * 100);
  const verdict = data.passed === data.total ? 'Accepted' : 'Wrong Answer';

  document.getElementById('results').innerHTML = `
    <div class="results-header">
      <strong>Test Case ${data.passed}/${data.total} passed (${pct}%)</strong>
      <span class="verdict ${verdict === 'Accepted' ? 'ok' : 'bad'}">${verdict}</span>
      <span class="muted">Run ${data.runCount}</span>
    </div>
    ${data.results.map((r, i) => `
      <div class="case ${r.passed ? 'pass' : 'fail'}">
        <div class="case-title">${r.passed ? '✓' : '✗'} Case ${i + 1}</div>
        <div class="case-body">
          <label>Input</label><pre>${escapeHtml(r.input)}</pre>
          <label>Output</label><pre>${escapeHtml(r.actual)}</pre>
          ${r.passed ? '' : `<label>Expected</label><pre>${escapeHtml(r.expected)}</pre>`}
          ${r.error ? `<label>Error</label><pre class="err">${escapeHtml(r.error)}</pre>` : ''}
        </div>
      </div>`).join('')}
  `;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function submitSolution() {
  if (!confirm('Submit your final solution? You will not be able to make further changes.')) return;

  const btn = document.getElementById('submit');
  btn.disabled = true;

  try {
    const res = await fetch(`/api/sessions/${sessionId}/submit`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      document.getElementById('results').innerHTML = `<p class="error">${data.error}</p>`;
      btn.disabled = false;
      return;
    }

    document.getElementById('run').disabled = true;
    editor.setOption('readOnly', true);
    btn.textContent = 'Submitted';
  } catch {
    document.getElementById('results').innerHTML = '<p class="error">Cannot reach the server</p>';
    btn.disabled = false;
  }
}

function startTimer(deadlineIso) {
  const deadline = new Date(deadlineIso).getTime();
  const el = document.getElementById('timer');

  const tick = () => {
    const left = deadline - Date.now();
    if (left <= 0) {
      el.textContent = '00:00:00 Left';
      document.getElementById('run').disabled = true;
      document.getElementById('submit').disabled = true;
      clearInterval(handle);
      return;
    }
    const h = String(Math.floor(left / 3600000)).padStart(2, '0');
    const m = String(Math.floor(left / 60000) % 60).padStart(2, '0');
    const s = String(Math.floor(left / 1000) % 60).padStart(2, '0');
    el.textContent = `${h}:${m}:${s} Left`;
  };

  tick();
  const handle = setInterval(tick, 1000);
}
document.getElementById('submit').addEventListener('click', submitSolution);

document.getElementById('run').addEventListener('click', run);
init();