const bcrypt = require('bcryptjs');
const db = require('./db');

const insertUser = db.prepare(
  'INSERT INTO users (username, password_hash, role, display_name, created_at) VALUES (?, ?, ?, ?, ?)'
);
const findByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const findById = db.prepare('SELECT id, username, role, display_name FROM users WHERE id = ?');
const countUsers = db.prepare('SELECT COUNT(*) AS n FROM users');

function createUser(username, password, role, displayName) {
  const hash = bcrypt.hashSync(password, 10);
  const info = insertUser.run(username, hash, role, displayName, new Date().toISOString());
  return { id: info.lastInsertRowid, username, role };
}

function verifyLogin(username, password) {
  const user = findByUsername.get(username);
  if (!user) {
    bcrypt.compareSync(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    return null;
  }
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return { id: user.id, username: user.username, role: user.role, displayName: user.display_name };
}

function getUserById(id) {
  const u = findById.get(id);
  if (!u) return null;
  return { id: u.id, username: u.username, role: u.role, displayName: u.display_name };
}

function seedUsers() {
  if (countUsers.get().n > 0) return;
  createUser('candidate', 'candidate123', 'candidate', 'Dhanapal M');
  createUser('reviewer', 'reviewer123', 'reviewer', 'Review Panel');
  console.log('Seeded default users');
}

module.exports = { createUser, verifyLogin, getUserById, seedUsers };