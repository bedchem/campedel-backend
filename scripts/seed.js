// Run: node --experimental-sqlite scripts/seed.js <type> <file>
// Example: node --experimental-sqlite scripts/seed.js menu "C:\path\menu.json"

const fs = require('fs');
const path = require('path');
const http = require('http');

const [,, type, filePath] = process.argv;

if (!type || !filePath) {
  console.log('Usage: node --experimental-sqlite scripts/seed.js <menu|drinks|wines> <path-to-json>');
  process.exit(1);
}

const data = fs.readFileSync(filePath, 'utf8');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3001,
  path: `/api/import/${type}`,
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const r = JSON.parse(body);
      if (r.ok) console.log(`✓ ${type}: ${r.sectionCount} Kategorien, ${r.itemCount} Einträge importiert`);
      else console.error('✗ Fehler:', r);
    } catch (e) {
      console.error('Antwort:', body);
    }
  });
});
req.on('error', e => console.error('Verbindungsfehler:', e.message));
req.write(data);
req.end();
