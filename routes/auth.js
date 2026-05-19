const express = require('express');
const router = express.Router();
const { getDb, hashPassword } = require('../db/database');

function makeToken(username, passwordHash) {
  return Buffer.from(`${username}:${passwordHash}`).toString('base64');
}

function verifyToken(token) {
  const decoded = Buffer.from(token, 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  if (idx === -1) return null;
  const username = decoded.slice(0, idx);
  const hash = decoded.slice(idx + 1);
  const user = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || user.password_hash !== hash) return null;
  return user;
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  const user = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || user.password_hash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }
  const token = makeToken(username, user.password_hash);
  res.json({ ok: true, token, username: user.username, role: user.role });
});

// GET /api/auth/verify
router.get('/verify', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.json({ ok: false });
  const user = verifyToken(auth.slice(7));
  if (!user) return res.json({ ok: false });
  res.json({ ok: true, username: user.username, role: user.role });
});

module.exports = router;
module.exports.verifyToken = verifyToken;
