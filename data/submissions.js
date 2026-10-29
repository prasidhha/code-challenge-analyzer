const db = require('./db');

const insertSession = db.prepare(
  'INSERT INTO challenge_sessions (id, user_id, problem_id, original_code, created_at) VALUES (?, ?, ?, ?, ?)'
);
const insertSubmission = db.prepare(
  'INSERT INTO submissions (session_id, problem_id, code, passed, total, created_at) VALUES (?, ?, ?, ?, ?, ?)'
);
const findSession = db.prepare('SELECT * FROM challenge_sessions WHERE id = ?');
const selectBySession = db.prepare(
  'SELECT * FROM submissions WHERE session_id = ? ORDER BY id'
);

const selectAllSessions = db.prepare(`
  SELECT cs.id, cs.problem_id, cs.created_at, cs.submitted_at,
         u.display_name, u.username,
         COUNT(s.id) AS run_count,
         MAX(s.passed) AS best_passed,
         MAX(s.total) AS total_cases
  FROM challenge_sessions cs
  LEFT JOIN users u ON u.id = cs.user_id
  LEFT JOIN submissions s ON s.session_id = cs.id
  GROUP BY cs.id
  ORDER BY cs.created_at DESC
`);

function listSessions() {
  return selectAllSessions.all();
}

function createSession(id, userId, problemId, originalCode) {
  insertSession.run(id, userId, problemId, originalCode, new Date().toISOString());
  return { id, userId, problemId };
}

function getSession(id) {
  return findSession.get(id);
}

function addSubmission({ sessionId, problemId, code, passed, total }) {
  const info = insertSubmission.run(
    sessionId, problemId, code, passed, total, new Date().toISOString()
  );
  return { id: info.lastInsertRowid };
}

function getBySession(sessionId) {
  return selectBySession.all(sessionId);
}

const markSubmitted = db.prepare(
  'UPDATE challenge_sessions SET submitted_at = ? WHERE id = ? AND submitted_at IS NULL'
);

function submitSession(id) {
  const info = markSubmitted.run(new Date().toISOString(), id);
  return info.changes > 0;
}
const findOpenSession = db.prepare(
  'SELECT * FROM challenge_sessions WHERE user_id = ? AND problem_id = ? AND submitted_at IS NULL ORDER BY created_at DESC LIMIT 1'
);

function getOpenSession(userId, problemId) {
  return findOpenSession.get(userId, problemId);
}
module.exports = { createSession, getSession, getOpenSession, addSubmission, getBySession, submitSession, listSessions };