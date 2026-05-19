# Campedèl Backend

Backend-API und Admin-Dashboard für die digitale Speisekarte des Campedèl-Hofs.

## Features

- REST-API für Speisen, Getränke und Weine
- Admin-Dashboard (Web-UI) zur Verwaltung aller Inhalte
- Bildupload mit automatischer WebP-Konvertierung
- Mehrsprachige Einträge (Deutsch, Italienisch, Englisch)
- Cloudflare Tunnel — öffentlicher Zugriff ohne Port-Forwarding
- Rate Limiting & Security Headers (Helmet)

---

## Schnellstart mit Docker Compose

### 1. Repository klonen

```bash
git clone https://github.com/dein-user/campedel-backend.git
cd campedel-backend
```

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
```

Dann `.env` bearbeiten:

```env
PORT=3002
ADMIN_PASSWORD=dein-sicheres-passwort
SECRET_SALT=ein-langer-random-key
BASE_URL=https://deine-domain.com

# Optional: Cloudflare Tunnel Token
# Leer lassen für automatischen Quick-Tunnel
TUNNEL_TOKEN=
```

### 3. Starten

```bash
docker compose up -d
```

Das startet:
- `campedel-backend` — API + Admin Dashboard auf Port 3002
- `campedel-cloudflared` — Cloudflare Tunnel (Quick Tunnel, kein Account nötig)

### 4. Admin Dashboard öffnen

Lokal: [http://localhost:3002/admin](http://localhost:3002/admin)

Standard-Login:
- **Benutzername:** `admin`
- **Passwort:** `campedel2024` (oder was du in `ADMIN_PASSWORD` gesetzt hast)

---

## Cloudflare Tunnel

### Quick Tunnel (kein Account nötig)

Startet automatisch mit `docker compose up`. Nach ~15 Sekunden erscheint im Admin Dashboard unter **Einstellungen** eine öffentliche URL wie `https://abc123.trycloudflare.com`.

### Named Tunnel (mit eigenem Domain)

1. Auf [dash.cloudflare.com](https://dash.cloudflare.com) → Zero Trust → Tunnels → Tunnel erstellen
2. Token kopieren
3. In `.env` eintragen: `TUNNEL_TOKEN=eyJhIjoi...`
4. Container neu starten: `docker compose restart cloudflared`
5. Im Admin Dashboard → Einstellungen → Token speichern

---

## Lokale Entwicklung (ohne Docker)

**Voraussetzungen:** Node.js 22+

```bash
npm install
cp .env.example .env
# .env anpassen

npm run dev   # mit Nodemon (Hot Reload)
# oder
npm start     # ohne Hot Reload
```

Server läuft auf [http://localhost:3002](http://localhost:3002)

---

## API Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| `GET` | `/api/menu` | Gesamte Speisekarte |
| `GET` | `/api/drinks` | Gesamte Getränkekarte |
| `GET` | `/api/wines` | Gesamte Weinkarte |
| `GET` | `/api/health` | Server-Status |
| `POST` | `/api/auth/login` | Anmelden |
| `POST` | `/api/import/menu` | Speisekarte importieren (JSON) |
| `POST` | `/api/import/drinks` | Getränkekarte importieren (JSON) |
| `POST` | `/api/import/wines` | Weinkarte importieren (JSON) |

Vollständige API-Dokumentation im Admin Dashboard unter **Dashboard → API Endpunkte**.

---

## Sicherheit

- **Rate Limiting:**
  - Global: 300 Anfragen / 15 Min
  - Login: 10 Versuche / 15 Min (Brute-Force-Schutz)
  - Upload: 30 Uploads / Stunde
- **Security Headers** via Helmet (X-Frame-Options, HSTS, X-Content-Type-Options etc.)
- **CORS:** Offen für alle Origins (für mobile App-Zugriff)
- **Authentifizierung:** Bearer Token für alle Admin-Endpunkte

---

## Verzeichnisstruktur

```
campedel-backend/
├── db/
│   └── database.js       # SQLite Setup & Schema
├── public/
│   └── admin/            # Admin Dashboard (HTML/CSS/JS)
├── routes/
│   ├── auth.js           # Login & Token-Verifizierung
│   ├── menu.js           # Speisekarte CRUD
│   ├── drinks.js         # Getränkekarte CRUD
│   ├── wines.js          # Weinkarte CRUD
│   ├── users.js          # Benutzerverwaltung
│   ├── upload.js         # Bildupload (→ WebP)
│   ├── stats.js          # Dashboard-Statistiken
│   ├── importData.js     # JSON-Massenimport
│   └── tunnel.js         # Cloudflare Tunnel Status API
├── scripts/
│   └── seed.js           # Datenbankbefüllung
├── uploads/              # Hochgeladene Bilder
├── .env.example          # Vorlage für Umgebungsvariablen
├── docker-compose.yml    # Docker Compose (Backend + Cloudflared)
├── Dockerfile            # Docker Image
└── server.js             # Express App Entry Point
```

---

## Daten sichern

Alle persistenten Daten liegen im Docker Volume `campedel-data` (gemountet unter `/app/data`):

```bash
# Backup
docker run --rm -v campedel-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/campedel-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm -v campedel-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/campedel-backup-DATUM.tar.gz -C /data
```
