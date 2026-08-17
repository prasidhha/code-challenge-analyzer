async function init() {
  const user = await loadUser('reviewer');
  if (!user) return;
  renderShell(user, 'submissions');

  const res = await fetch('/api/sessions');
  const sessions = await res.json();

  document.getElementById('session-list').innerHTML = `
    <table class="session-table">
      <thead><tr>
        <th>Candidate</th><th>Problem</th><th>Runs</th>
        <th>Best score</th><th>Status</th><th>Started</th><th></th>
      </tr></thead>
      <tbody>
        ${sessions.map(s => `
          <tr>
            <td>${escapeHtml(s.display_name || 'Unknown')}</td>
            <td>${s.problem_id}</td>
            <td>${s.run_count}</td>
            <td>${s.best_passed == null ? '—' : `${s.best_passed}/${s.total_cases}`}</td>
            <td><span class="status ${s.submitted_at ? 'done' : 'progress'}">
              ${s.submitted_at ? 'Submitted' : 'InProgress'}</span></td>
            <td>${new Date(s.created_at).toLocaleString()}</td>
            <td><a class="link-btn" href="/review.html?session=${s.id}">Review</a></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

init();