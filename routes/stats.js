const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/stats
router.get('/', (req, res) => {
  const db = getDb();
  const q = sql => db.prepare(sql).get();
  res.json({
    menu: {
      sections: q('SELECT COUNT(*) as n FROM menu_sections').n,
      items:    q('SELECT COUNT(*) as n FROM menu_items').n,
      withImage:   q("SELECT COUNT(*) as n FROM menu_items WHERE image_url IS NOT NULL AND image_url != ''").n,
      vegetarian:  q('SELECT COUNT(*) as n FROM menu_items WHERE is_vegetarian = 1').n,
      vegan:       q('SELECT COUNT(*) as n FROM menu_items WHERE is_vegan = 1').n,
    },
    drinks: {
      sections: q('SELECT COUNT(*) as n FROM drink_sections').n,
      items:    q('SELECT COUNT(*) as n FROM drink_items').n,
      withImage: q("SELECT COUNT(*) as n FROM drink_items WHERE image_url IS NOT NULL AND image_url != ''").n,
    },
    wines: {
      sections: q('SELECT COUNT(*) as n FROM wine_sections').n,
      items:    q('SELECT COUNT(*) as n FROM wine_items').n,
      withImage: q("SELECT COUNT(*) as n FROM wine_items WHERE image_url IS NOT NULL AND image_url != ''").n,
    },
    users: q('SELECT COUNT(*) as n FROM users').n,
  });
});

module.exports = router;
