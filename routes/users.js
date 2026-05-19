const express = require('express');
const router = express.Router();
const { getDb, hashPassword } = require('../db/database');
const { verifyToken } = require('./auth');

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht angemeldet' });
  const user = verifyToken(auth.slice(7));
  if (!user) return res.status(401).json({ error: 'Ungültiges Token' });
  req.user = user;
  next();
}

// GET /api/users
router.get('/', requireAuth, (req, res) => {
  const users = getDb().prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
  res.json(users);
});

// POST /api/users
router.post('/', requireAuth, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
    return res.status(400).json({ error: 'Username: 2-32 Zeichen, nur Buchstaben/Zahlen/_.-' });
  }
  try {
    getDb().prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run(username, hashPassword(password), role || 'admin');
    res.json({ ok: true });
  } catch (e) {
    res.status(409).json({ error: 'Username bereits vergeben' });
  }
});

// PUT /api/users/:id/password
router.put('/:id/password', requireAuth, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Passwort mindestens 6 Zeichen' });
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id);
  res.json({ ok: true });
});

// PUT /api/users/:id/role
router.put('/:id/role', requireAuth, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'editor'].includes(role)) return res.status(400).json({ error: 'Ungültige Rolle' });
  getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, parseInt(req.params.id));
  res.json({ ok: true });
});

// DELETE /api/users/:id
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id);
  if (req.user.id === id) return res.status(400).json({ error: 'Eigenes Konto kann nicht gelöscht werden' });
  const count = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (count <= 1) return res.status(400).json({ error: 'Letzter Benutzer kann nicht gelöscht werden' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
