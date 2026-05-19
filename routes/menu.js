const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

const toItem = item => ({
  ...item,
  allergens: JSON.parse(item.allergens || '[]'),
});

// GET /api/menu — app-format
router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=30');
  const db = getDb();
  const sections = db.prepare('SELECT * FROM menu_sections ORDER BY sort_order').all();
  const items = db.prepare('SELECT * FROM menu_items ORDER BY sort_order');
  const result = sections.map(s => ({
    id: s.id,
    categoryKey: s.category_key,
    icon: s.icon,
    gradientStart: s.gradient_start,
    gradientEnd: s.gradient_end,
    items: db.prepare('SELECT * FROM menu_items WHERE section_id = ? ORDER BY sort_order').all(s.id).map(item => ({
      id: item.id,
      name: { de: item.name_de, it: item.name_it, en: item.name_en },
      description: { de: item.description_de, it: item.description_it, en: item.description_en },
      price: item.price,
      allergens: JSON.parse(item.allergens || '[]'),
      isVegetarian: !!item.is_vegetarian,
      isVegan: !!item.is_vegan,
      imageUrl: item.image_url,
    })),
  }));
  res.json(result);
});

router.get('/sections', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM menu_sections ORDER BY sort_order').all());
});

router.post('/sections', (req, res) => {
  const db = getDb();
  const { id, category_key, icon, gradient_start, gradient_end, sort_order } = req.body;
  if (!id || !category_key) return res.status(400).json({ error: 'id and category_key required' });
  db.prepare('INSERT INTO menu_sections (id,category_key,icon,gradient_start,gradient_end,sort_order) VALUES (?,?,?,?,?,?)')
    .run(id, category_key, icon || 'restaurant-outline', gradient_start || '#FFF0CC', gradient_end || '#FFD580', sort_order || 0);
  res.json({ ok: true });
});

router.put('/sections/:id', (req, res) => {
  const { category_key, icon, gradient_start, gradient_end, sort_order } = req.body;
  getDb().prepare('UPDATE menu_sections SET category_key=?,icon=?,gradient_start=?,gradient_end=?,sort_order=? WHERE id=?')
    .run(category_key, icon, gradient_start, gradient_end, sort_order, req.params.id);
  res.json({ ok: true });
});

router.delete('/sections/:id', (req, res) => {
  getDb().prepare('DELETE FROM menu_sections WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/items', (req, res) => {
  const db = getDb();
  const { section_id } = req.query;
  const rows = section_id
    ? db.prepare('SELECT * FROM menu_items WHERE section_id=? ORDER BY sort_order').all(section_id)
    : db.prepare('SELECT * FROM menu_items ORDER BY sort_order').all();
  res.json(rows.map(toItem));
});

router.post('/items', (req, res) => {
  const db = getDb();
  const { id, section_id, name_de, name_it, name_en, description_de, description_it, description_en,
    price, allergens, is_vegetarian, is_vegan, image_url, sort_order } = req.body;
  if (!id || !section_id || !name_de) return res.status(400).json({ error: 'id, section_id and name_de required' });
  db.prepare(`INSERT INTO menu_items (id,section_id,name_de,name_it,name_en,description_de,description_it,description_en,price,allergens,is_vegetarian,is_vegan,image_url,sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, section_id, name_de, name_it || '', name_en || '',
      description_de || '', description_it || '', description_en || '',
      price || 0, JSON.stringify(allergens || []),
      is_vegetarian ? 1 : 0, is_vegan ? 1 : 0, image_url || null, sort_order || 0);
  res.json({ ok: true });
});

router.put('/items/:id', (req, res) => {
  const { section_id, name_de, name_it, name_en, description_de, description_it, description_en,
    price, allergens, is_vegetarian, is_vegan, image_url, sort_order } = req.body;
  getDb().prepare(`UPDATE menu_items SET section_id=?,name_de=?,name_it=?,name_en=?,description_de=?,description_it=?,description_en=?,
    price=?,allergens=?,is_vegetarian=?,is_vegan=?,image_url=?,sort_order=? WHERE id=?`)
    .run(section_id, name_de, name_it || '', name_en || '',
      description_de || '', description_it || '', description_en || '',
      price || 0, JSON.stringify(allergens || []),
      is_vegetarian ? 1 : 0, is_vegan ? 1 : 0, image_url || null, sort_order || 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/items/:id', (req, res) => {
  getDb().prepare('DELETE FROM menu_items WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
