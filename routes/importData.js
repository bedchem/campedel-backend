const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// POST /api/import/menu
router.post('/menu', (req, res) => {
  const db = getDb();
  const data = req.body;
  if (!data || !Array.isArray(data.sections)) {
    return res.status(400).json({ error: 'Expected { sections: [...] }' });
  }

  const insertSection = db.prepare(
    'INSERT OR REPLACE INTO menu_sections (id,category_key,icon,gradient_start,gradient_end,sort_order) VALUES (?,?,?,?,?,?)'
  );
  const insertItem = db.prepare(
    `INSERT OR REPLACE INTO menu_items (id,section_id,name_de,name_it,name_en,description_de,description_it,description_en,price,allergens,is_vegetarian,is_vegan,image_url,sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  let sectionCount = 0, itemCount = 0;
  db.exec('BEGIN');
  try {
    data.sections.forEach((section, si) => {
      insertSection.run(
        section.id, section.categoryKey || section.id,
        section.icon || 'restaurant-outline',
        section.gradientStart || '#FFF0CC',
        section.gradientEnd || '#FFD580',
        si
      );
      sectionCount++;
      (section.items || []).forEach((item, ii) => {
        const name = item.name || {};
        const desc = item.description || {};
        insertItem.run(
          item.id, section.id,
          name.de || '', name.it || '', name.en || '',
          desc.de || '', desc.it || '', desc.en || '',
          item.price || 0,
          JSON.stringify(item.allergens || []),
          item.isVegetarian ? 1 : 0,
          item.isVegan ? 1 : 0,
          item.imageUrl || null,
          ii
        );
        itemCount++;
      });
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: e.message });
  }

  res.json({ ok: true, sectionCount, itemCount });
});

// POST /api/import/drinks
router.post('/drinks', (req, res) => {
  const db = getDb();
  const data = req.body;
  if (!data || !Array.isArray(data.sections)) {
    return res.status(400).json({ error: 'Expected { sections: [...] }' });
  }

  const insertSection = db.prepare(
    'INSERT OR REPLACE INTO drink_sections (id,category_key,icon,sort_order) VALUES (?,?,?,?)'
  );
  const insertItem = db.prepare(
    'INSERT OR REPLACE INTO drink_items (id,section_id,name_de,name_it,name_en,prices,image_url,sort_order) VALUES (?,?,?,?,?,?,?,?)'
  );

  let sectionCount = 0, itemCount = 0;
  db.exec('BEGIN');
  try {
    data.sections.forEach((section, si) => {
      insertSection.run(section.id, section.categoryKey || section.id, section.icon || 'cafe-outline', si);
      sectionCount++;
      (section.items || []).forEach((item, ii) => {
        const name = item.name || {};
        insertItem.run(
          item.id, section.id,
          name.de || '', name.it || '', name.en || '',
          JSON.stringify(item.prices || []),
          item.imageUrl || null, ii
        );
        itemCount++;
      });
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: e.message });
  }

  res.json({ ok: true, sectionCount, itemCount });
});

// POST /api/import/wines
router.post('/wines', (req, res) => {
  const db = getDb();
  const data = req.body;
  const sections = Array.isArray(data) ? data : data.sections;
  if (!Array.isArray(sections)) {
    return res.status(400).json({ error: 'Expected array of sections or { sections: [...] }' });
  }

  const insertSection = db.prepare(
    'INSERT OR REPLACE INTO wine_sections (id,category,sort_order) VALUES (?,?,?)'
  );
  const insertItem = db.prepare(
    `INSERT OR REPLACE INTO wine_items (id,section_id,name,winery,region,doc,dryness,grapes,description_de,description_it,price_bottle,price_glass,price_carafe,image_url,sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  let sectionCount = 0, itemCount = 0;
  db.exec('BEGIN');
  try {
    sections.forEach((section, si) => {
      const secId = section.id || section.category;
      insertSection.run(secId, section.category, si);
      sectionCount++;
      (section.wines || []).forEach((wine, wi) => {
        const desc = wine.description || {};
        const prices = wine.prices || {};
        insertItem.run(
          wine.id, secId,
          wine.name || '', wine.winery || '', wine.region || '',
          wine.doc || '', wine.dryness || '',
          JSON.stringify(wine.grapes || []),
          desc.de || '', desc.it || '',
          prices.bottle ?? null, prices.glass ?? null, prices.carafe ?? null,
          wine.imageUrl || null, wi
        );
        itemCount++;
      });
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: e.message });
  }

  res.json({ ok: true, sectionCount, itemCount });
});

module.exports = router;
