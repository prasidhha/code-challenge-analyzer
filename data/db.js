const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'analyzer.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    problem_id INTEGER NOT NULL,
    original_code TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    problem_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    passed INTEGER,
    total INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );
`);

module.exports = db;