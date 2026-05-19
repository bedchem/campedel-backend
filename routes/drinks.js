const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/drinks — full drink list for the app
router.get('/', (req, res) => {
  const db = getDb();
  const sections = db.prepare('SELECT * FROM drink_sections ORDER BY sort_order').all();
  const result = sections.map(s => ({
    id: s.id,
    categoryKey: s.category_key,
    icon: s.icon,
    items: db.prepare('SELECT * FROM drink_items WHERE section_id=? ORDER BY sort_order').all(s.id).map(item => ({
      id: item.id,
      name: { de: item.name_de, it: item.name_it, en: item.name_en },
      prices: JSON.parse(item.prices || '[]'),
      imageUrl: item.image_url,
    })),
  }));
  res.json(result);
});

// GET /api/drinks/sections
router.get('/sections', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM drink_sections ORDER BY sort_order').all());
});

// POST /api/drinks/sections
router.post('/sections', (req, res) => {
  const db = getDb();
  const { id, category_key, icon, sort_order } = req.body;
  if (!id || !category_key) return res.status(400).json({ error: 'id and category_key required' });
  db.prepare('INSERT INTO drink_sections (id,category_key,icon,sort_order) VALUES (?,?,?,?)')
    .run(id, category_key, icon || 'cafe-outline', sort_order || 0);
  res.json({ ok: true });
});

// PUT /api/drinks/sections/:id
router.put('/sections/:id', (req, res) => {
  const { category_key, icon, sort_order } = req.body;
  getDb().prepare('UPDATE drink_sections SET category_key=?,icon=?,sort_order=? WHERE id=?')
    .run(category_key, icon, sort_order, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/drinks/sections/:id
router.delete('/sections/:id', (req, res) => {
  getDb().prepare('DELETE FROM drink_sections WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/drinks/items
router.get('/items', (req, res) => {
  const db = getDb();
  const { section_id } = req.query;
  const stmt = section_id
    ? db.prepare('SELECT * FROM drink_items WHERE section_id=? ORDER BY sort_order')
    : db.prepare('SELECT * FROM drink_items ORDER BY sort_order');
  const rows = section_id ? stmt.all(section_id) : stmt.all();
  res.json(rows.map(r => ({ ...r, prices: JSON.parse(r.prices || '[]') })));
});

// POST /api/drinks/items
router.post('/items', (req, res) => {
  const db = getDb();
  const { id, section_id, name_de, name_it, name_en, prices, image_url, sort_order } = req.body;
  if (!id || !section_id || !name_de) return res.status(400).json({ error: 'id, section_id and name_de required' });
  db.prepare('INSERT INTO drink_items (id,section_id,name_de,name_it,name_en,prices,image_url,sort_order) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, section_id, name_de, name_it || '', name_en || '', JSON.stringify(prices || []), image_url || null, sort_order || 0);
  res.json({ ok: true });
});

// PUT /api/drinks/items/:id
router.put('/items/:id', (req, res) => {
  const { section_id, name_de, name_it, name_en, prices, image_url, sort_order } = req.body;
  getDb().prepare('UPDATE drink_items SET section_id=?,name_de=?,name_it=?,name_en=?,prices=?,image_url=?,sort_order=? WHERE id=?')
    .run(section_id, name_de, name_it || '', name_en || '', JSON.stringify(prices || []), image_url || null, sort_order || 0, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/drinks/items/:id
router.delete('/items/:id', (req, res) => {
  getDb().prepare('DELETE FROM drink_items WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
