const db = require('./db');

const insertSession = db.prepare(
  'INSERT INTO sessions (id, problem_id, original_code, created_at) VALUES (?, ?, ?, ?)'
);
const findSession = db.prepare('SELECT * FROM sessions WHERE id = ?');
const insertSubmission = db.prepare(
  'INSERT INTO submissions (session_id, problem_id, code, passed, total, created_at) VALUES (?, ?, ?, ?, ?, ?)'
);
const selectBySession = db.prepare(
  'SELECT * FROM submissions WHERE session_id = ? ORDER BY id'
);

function createSession(id, problemId, originalCode) {
  insertSession.run(id, problemId, originalCode, new Date().toISOString());
  return { id, problemId };
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

module.exports = { createSession, getSession, addSubmission, getBySession };