const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/wines — full wine list for the app
router.get('/', (req, res) => {
  const db = getDb();
  const sections = db.prepare('SELECT * FROM wine_sections ORDER BY sort_order').all();
  const result = sections.map(s => ({
    category: s.category,
    id: s.id,
    wines: db.prepare('SELECT * FROM wine_items WHERE section_id=? ORDER BY sort_order').all(s.id).map(w => ({
      id: w.id,
      name: w.name,
      winery: w.winery,
      region: w.region,
      doc: w.doc,
      dryness: w.dryness,
      grapes: JSON.parse(w.grapes || '[]'),
      description: { de: w.description_de, it: w.description_it },
      prices: {
        ...(w.price_bottle != null ? { bottle: w.price_bottle } : {}),
        ...(w.price_glass != null ? { glass: w.price_glass } : {}),
        ...(w.price_carafe != null ? { carafe: w.price_carafe } : {}),
      },
      imageUrl: w.image_url,
    })),
  }));
  res.json(result);
});

// GET /api/wines/sections
router.get('/sections', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM wine_sections ORDER BY sort_order').all());
});

// POST /api/wines/sections
router.post('/sections', (req, res) => {
  const db = getDb();
  const { id, category, sort_order } = req.body;
  if (!id || !category) return res.status(400).json({ error: 'id and category required' });
  db.prepare('INSERT INTO wine_sections (id,category,sort_order) VALUES (?,?,?)').run(id, category, sort_order || 0);
  res.json({ ok: true });
});

// PUT /api/wines/sections/:id
router.put('/sections/:id', (req, res) => {
  const { category, sort_order } = req.body;
  getDb().prepare('UPDATE wine_sections SET category=?,sort_order=? WHERE id=?').run(category, sort_order, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/wines/sections/:id
router.delete('/sections/:id', (req, res) => {
  getDb().prepare('DELETE FROM wine_sections WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/wines/items
router.get('/items', (req, res) => {
  const db = getDb();
  const { section_id } = req.query;
  const stmt = section_id
    ? db.prepare('SELECT * FROM wine_items WHERE section_id=? ORDER BY sort_order')
    : db.prepare('SELECT * FROM wine_items ORDER BY sort_order');
  const rows = section_id ? stmt.all(section_id) : stmt.all();
  res.json(rows.map(r => ({ ...r, grapes: JSON.parse(r.grapes || '[]') })));
});

// POST /api/wines/items
router.post('/items', (req, res) => {
  const db = getDb();
  const { id, section_id, name, winery, region, doc, dryness, grapes,
    description_de, description_it, price_bottle, price_glass, price_carafe, image_url, sort_order } = req.body;
  if (!id || !section_id || !name) return res.status(400).json({ error: 'id, section_id and name required' });
  db.prepare(`INSERT INTO wine_items (id,section_id,name,winery,region,doc,dryness,grapes,description_de,description_it,price_bottle,price_glass,price_carafe,image_url,sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, section_id, name, winery || '', region || '', doc || '', dryness || '',
      JSON.stringify(grapes || []), description_de || '', description_it || '',
      price_bottle ?? null, price_glass ?? null, price_carafe ?? null, image_url || null, sort_order || 0);
  res.json({ ok: true });
});

// PUT /api/wines/items/:id
router.put('/items/:id', (req, res) => {
  const { section_id, name, winery, region, doc, dryness, grapes,
    description_de, description_it, price_bottle, price_glass, price_carafe, image_url, sort_order } = req.body;
  getDb().prepare(`UPDATE wine_items SET section_id=?,name=?,winery=?,region=?,doc=?,dryness=?,grapes=?,description_de=?,description_it=?,
    price_bottle=?,price_glass=?,price_carafe=?,image_url=?,sort_order=? WHERE id=?`)
    .run(section_id, name, winery || '', region || '', doc || '', dryness || '',
      JSON.stringify(grapes || []), description_de || '', description_it || '',
      price_bottle ?? null, price_glass ?? null, price_carafe ?? null, image_url || null, sort_order || 0, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/wines/items/:id
router.delete('/items/:id', (req, res) => {
  getDb().prepare('DELETE FROM wine_items WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
