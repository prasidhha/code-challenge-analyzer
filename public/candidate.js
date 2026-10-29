let editor = null;
let sessionId = null;
let currentProblem = null;

const MODES = {
  python: 'python',
  java: 'text/x-java',
  c: 'text/x-csrc',
  cpp: 'text/x-c++src',
  javascript: 'javascript'
};

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function init() {
  const user = await loadUser('candidate');
  if (!user) return;
  renderShell(user, 'compiler');

  const res = await fetch('/api/problems');
  const problems = await res.json();

  const list = document.getElementById('problem-list');
  list.innerHTML = problems.map(p =>
    '<div class="problem-row" data-id="' + p.id + '">' +
      '<span>' + escapeHtml(p.title) + '</span>' +
      '<span class="status progress">InProgress</span>' +
    '</div>'
  ).join('');

  list.querySelectorAll('.problem-row').forEach(row => {
    row.addEventListener('click', () => openProblem(Number(row.dataset.id)));
  });
}

async function openProblem(id) {
  const res = await fetch('/api/problems/' + id);
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

  renderTestCards();
  setupEditor();
  editor.setValue(session.code);
}

function renderTestCards() {
  const samples = currentProblem.sampleCases || [];
  let html = '';

  samples.forEach((t, i) => {
    html += '<div class="test-card">' +
      '<div class="test-title">Test ' + (i + 1) + '</div>' +
      '<div class="test-body">' +
        '<div><span class="label">Input:</span> ' + escapeHtml(t.input.trim()) + '</div>' +
        '<div><span class="label">Expected:</span> ' + escapeHtml(t.expectedOutput.trim()) + '</div>' +
      '</div>' +
    '</div>';
  });

  html += '<p class="muted">' + currentProblem.totalCases + ' test cases will be run on submission.</p>';
  document.getElementById('test-list').innerHTML = html;
}

function setupEditor() {
  const mode = MODES[currentProblem.language] || 'python';

  if (!editor) {
    editor = CodeMirror.fromTextArea(document.getElementById('code'), {
      mode: mode,
      lineNumbers: true,
      indentUnit: 4
    });
  } else {
    editor.setOption('mode', mode);
  }

  editor.setOption('readOnly', false);
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
      body: JSON.stringify({
        sessionId: sessionId,
        problemId: currentProblem.id,
        code: editor.getValue()
      })
    });
    const data = await res.json();

    if (!res.ok) {
      results.innerHTML = '<p class="error">' + escapeHtml(data.error) + '</p>';
      return;
    }
    renderResults(data);
  } catch (err) {
    results.innerHTML = '<p class="error">Run failed: ' + escapeHtml(err.message) + '</p>';
  } finally {
    btn.disabled = false;
  }
}

async function submitSolution() {
  if (!confirm('Submit your final solution? You will not be able to make further changes.')) return;

  const btn = document.getElementById('submit');
  btn.disabled = true;

  try {
    const res = await fetch('/api/sessions/' + sessionId + '/submit', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      document.getElementById('results').innerHTML =
        '<p class="error">' + escapeHtml(data.error) + '</p>';
      btn.disabled = false;
      return;
    }

    document.getElementById('run').disabled = true;
    editor.setOption('readOnly', true);
    btn.textContent = 'Submitted';
  } catch (err) {
    document.getElementById('results').innerHTML =
      '<p class="error">Submit failed: ' + escapeHtml(err.message) + '</p>';
    btn.disabled = false;
  }
}

function renderResults(data) {
  const el = document.getElementById('results');

  if (data.compileError) {
    el.innerHTML =
      '<div class="results-header">' +
        '<strong>' + escapeHtml(data.compileError) + '</strong>' +
      '</div>' +
      '<pre class="err">' + escapeHtml(data.compileOutput || '') + '</pre>';
    return;
  }

  const pct = Math.round((data.passed / data.total) * 100);
  const accepted = data.passed === data.total;
  const verdict = accepted ? 'Accepted' : 'Wrong Answer';

  let html =
    '<div class="results-header">' +
      '<strong>Test Case ' + data.passed + '/' + data.total + ' passed (' + pct + '%)</strong> ' +
      '<span class="verdict ' + (accepted ? 'ok' : 'bad') + '">' + verdict + '</span> ' +
      '<span class="muted">Run ' + data.runCount + '</span>' +
    '</div>';

  data.results.forEach((r, i) => {
    html += '<div class="case ' + (r.passed ? 'pass' : 'fail') + '">' +
      '<div class="case-title">' + (r.passed ? '✓' : '✗') + ' Case ' + (i + 1) + '</div>' +
      '<div class="case-body">' +
        '<label>Input</label><pre>' + escapeHtml(r.input) + '</pre>' +
        '<label>Output</label><pre>' + escapeHtml(r.actual) + '</pre>';

    if (!r.passed) {
      html += '<label>Expected</label><pre>' + escapeHtml(r.expected) + '</pre>';
    }
    if (r.error) {
      html += '<label>Error</label><pre class="err">' + escapeHtml(r.error) + '</pre>';
    }

    html += '</div></div>';
  });

  el.innerHTML = html;
}

document.getElementById('run').addEventListener('click', run);
document.getElementById('submit').addEventListener('click', submitSolution);

init();