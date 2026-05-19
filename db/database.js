const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');

const DATA_DIR = process.env.UPLOAD_DIR ? path.dirname(process.env.UPLOAD_DIR) : path.join(__dirname, '..');
const DB_PATH = path.join(DATA_DIR, 'data.db');
let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    initSchema();
    seedDefaultAdmin();
  }
  return db;
}

function hashPassword(password) {
  const salt = process.env.SECRET_SALT || 'campedel-secret-2024';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

function seedDefaultAdmin() {
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (row.count === 0) {
    const hash = hashPassword(process.env.ADMIN_PASSWORD || 'campedel2024');
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
    console.log('Default admin created: admin / campedel2024');
  }
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menu_sections (
      id TEXT PRIMARY KEY,
      category_key TEXT NOT NULL,
      icon TEXT DEFAULT 'restaurant-outline',
      gradient_start TEXT DEFAULT '#FFF0CC',
      gradient_end TEXT DEFAULT '#FFD580',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      name_de TEXT NOT NULL,
      name_it TEXT DEFAULT '',
      name_en TEXT DEFAULT '',
      description_de TEXT DEFAULT '',
      description_it TEXT DEFAULT '',
      description_en TEXT DEFAULT '',
      price REAL DEFAULT 0,
      allergens TEXT DEFAULT '[]',
      is_vegetarian INTEGER DEFAULT 0,
      is_vegan INTEGER DEFAULT 0,
      image_url TEXT DEFAULT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (section_id) REFERENCES menu_sections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS drink_sections (
      id TEXT PRIMARY KEY,
      category_key TEXT NOT NULL,
      icon TEXT DEFAULT 'cafe-outline',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS drink_items (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      name_de TEXT NOT NULL,
      name_it TEXT DEFAULT '',
      name_en TEXT DEFAULT '',
      prices TEXT DEFAULT '[]',
      image_url TEXT DEFAULT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (section_id) REFERENCES drink_sections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wine_sections (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS wine_items (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      name TEXT NOT NULL,
      winery TEXT DEFAULT '',
      region TEXT DEFAULT '',
      doc TEXT DEFAULT '',
      dryness TEXT DEFAULT '',
      grapes TEXT DEFAULT '[]',
      description_de TEXT DEFAULT '',
      description_it TEXT DEFAULT '',
      price_bottle REAL DEFAULT NULL,
      price_glass REAL DEFAULT NULL,
      price_carafe REAL DEFAULT NULL,
      image_url TEXT DEFAULT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (section_id) REFERENCES wine_sections(id) ON DELETE CASCADE
    );
  `);
}

module.exports = { getDb, hashPassword };
