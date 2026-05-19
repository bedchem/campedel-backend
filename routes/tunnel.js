const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process'); // spawn used for cloudflared login
const router = express.Router();
const { verifyToken } = require('./auth');

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht angemeldet' });
  const user = verifyToken(auth.slice(7));
  if (!user) return res.status(401).json({ error: 'Ungültiges Token' });
  req.user = user;
  next();
}

const DATA_DIR = process.env.DATA_DIR
  || (process.env.UPLOAD_DIR ? path.dirname(process.env.UPLOAD_DIR) : path.join(__dirname, '..', 'data'));

const CF_HOME    = path.join(process.env.HOME || os.homedir(), '.cloudflared');
const CERT_PATH  = path.join(CF_HOME, 'cert.pem');
const CONFIG_PATH = path.join(CF_HOME, 'config.yml');
const LOG_PATH   = path.join(CF_HOME, 'tunnel.log');
const STATE_PATH = path.join(DATA_DIR, 'cloudflared-state.json');
const QUICK_LOG  = path.join(DATA_DIR, 'cf.log');

let _loginProc = null;
let _loginUrl  = null;

// ── Helpers ─────────────────────────────────────────────────────────

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); }
  catch { return null; }
}

function writeState(update) {
  const next = { ...(readState() || {}), ...update, updatedAt: new Date().toISOString() };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2));
  return next;
}

function cfBin() {
  try {
    const p = execSync('command -v cloudflared 2>/dev/null', { shell: true, encoding: 'utf8' }).trim();
    return p || null;
  } catch { return null; }
}

function cfRunning() {
  // Docker sidecar: check via socket
  try {
    const out = execSync(
      'curl -sf --unix-socket /var/run/docker.sock "http://localhost/containers/campedel-cloudflared/json"',
      { shell: true, encoding: 'utf8', timeout: 3000 }
    );
    if (JSON.parse(out)?.State?.Running) return true;
  } catch {}
  // Host-based fallback
  try { execSync('pgrep -x cloudflared', { stdio: 'pipe' }); return true; } catch {}
  try {
    return execSync('systemctl is-active cloudflared 2>/dev/null', {
      shell: true, encoding: 'utf8',
    }).trim() === 'active';
  } catch {}
  return false;
}

function quickUrl() {
  for (const logPath of [LOG_PATH, QUICK_LOG]) {
    try {
      const log = fs.readFileSync(logPath, 'utf8');
      const m = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m) return m[0];
    } catch {}
  }
  return null;
}

// ── Routes ──────────────────────────────────────────────────────────

// GET /api/tunnel/status
router.get('/status', requireAuth, (_req, res) => {
  const state        = readState();
  const installed    = !!cfBin();
  const authenticated = fs.existsSync(CERT_PATH);
  const configured   = !!(state?.configured && fs.existsSync(CONFIG_PATH));
  const running      = configured && cfRunning();
  const qUrl         = !running ? quickUrl() : null;

  res.json({
    installed,
    authenticated,
    configured,
    running: running || !!qUrl,
    hostname:   state?.hostname   || null,
    url:        state?.hostname   ? `https://${state.hostname}` : qUrl,
    tunnelId:   state?.tunnelId   || null,
    tunnelName: state?.tunnelName || null,
    mode:       configured ? 'named' : (qUrl ? 'quick' : 'local'),
    loginUrl:   _loginUrl,
  });
});

// POST /api/tunnel/install
router.post('/install', requireAuth, (_req, res) => {
  if (cfBin()) return res.json({ ok: true, already: true });
  const archMap = { x64: 'amd64', arm64: 'arm64', arm: 'arm' };
  const arch = archMap[os.arch()] || 'amd64';
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}`;
  try {
    execSync(
      `curl -fsSL "${url}" -o /tmp/cloudflared && chmod +x /tmp/cloudflared && mv /tmp/cloudflared /usr/local/bin/cloudflared`,
      { shell: true, timeout: 120000 }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Installation fehlgeschlagen', detail: e.stderr?.toString() || e.message });
  }
});

// POST /api/tunnel/login — spawn cloudflared tunnel login, capture auth URL
router.post('/login', requireAuth, (req, res) => {
  if (fs.existsSync(CERT_PATH)) return res.json({ ok: true, already: true });
  if (_loginProc && _loginProc.exitCode === null) return res.json({ ok: true, loginUrl: _loginUrl });

  const bin = cfBin();
  if (!bin) return res.status(400).json({ error: 'cloudflared nicht installiert' });

  _loginUrl = null;
  _loginProc = spawn(bin, ['tunnel', 'login'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  const capture = (d) => {
    const t = d.toString();
    const m = t.match(/https:\/\/dash\.cloudflare\.com\/[^\s\n]+/);
    if (m && !_loginUrl) _loginUrl = m[0].replace(/\s+$/, '');
  };
  _loginProc.stdout.on('data', capture);
  _loginProc.stderr.on('data', capture);
  _loginProc.on('exit', () => { _loginProc = null; });

  // Poll up to 5s for the URL, then respond
  const deadline = Date.now() + 5000;
  const poll = () => {
    if (_loginUrl || Date.now() >= deadline) return res.json({ ok: true, loginUrl: _loginUrl });
    setTimeout(poll, 200);
  };
  poll();
});

// GET /api/tunnel/login-check
router.get('/login-check', requireAuth, (_req, res) => {
  const done = fs.existsSync(CERT_PATH);
  if (done && _loginProc) {
    try { _loginProc.kill(); } catch {}
    _loginProc = null;
    _loginUrl  = null;
  }
  res.json({ done, loginUrl: _loginUrl });
});

// POST /api/tunnel/configure { hostname, tunnelName? }
router.post('/configure', requireAuth, (req, res) => {
  const { hostname, tunnelName = process.env.TUNNEL_NAME || 'campedel' } = req.body;
  if (!hostname) return res.status(400).json({ error: 'Hostname fehlt' });
  const bin = cfBin();
  if (!bin) return res.status(400).json({ error: 'cloudflared nicht installiert' });
  if (!fs.existsSync(CERT_PATH)) return res.status(400).json({ error: 'Nicht authentifiziert' });

  try {
    fs.mkdirSync(CF_HOME, { recursive: true });

    // Create or reuse named tunnel
    let tunnelId = '';
    try {
      const list = execSync(`"${bin}" tunnel list`, { encoding: 'utf8', timeout: 15000 });
      const row = list.split('\n').find(l => l.includes(tunnelName));
      if (row) tunnelId = row.trim().split(/\s+/)[0];
    } catch {}

    if (!tunnelId) {
      const out = execSync(`"${bin}" tunnel create "${tunnelName}"`, { encoding: 'utf8', timeout: 30000 });
      const m = out.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/);
      if (!m) return res.status(500).json({ error: 'Tunnel-ID nicht ermittelbar', detail: out });
      tunnelId = m[0];
    }

    // Write config.yml
    const credsFile = path.join(CF_HOME, `${tunnelId}.json`);
    const port = process.env.PORT || 3002;
    fs.writeFileSync(CONFIG_PATH,
      `tunnel: ${tunnelId}\ncredentials-file: ${credsFile}\nlogfile: ${LOG_PATH}\n\n` +
      `ingress:\n  - hostname: ${hostname}\n    service: http://localhost:${port}\n` +
      `  - service: http_status:404\n`
    );

    // Route DNS (best-effort)
    let dnsOk = false;
    try {
      execSync(`"${bin}" tunnel route dns "${tunnelName}" "${hostname}"`, { timeout: 30000 });
      dnsOk = true;
    } catch {}

    const state = writeState({
      installed: true, authenticated: true, configured: true,
      tunnelId, tunnelName, hostname, dnsOk,
    });

        // Kill cloudflared — entrypoint loop restarts it with the new named tunnel config
    _restartTunnel();

    res.json({ ok: true, state, dnsOk });
  } catch (e) {
    res.status(500).json({ error: 'Konfiguration fehlgeschlagen', detail: e.stderr?.toString() || e.message });
  }
});

// POST /api/tunnel/reconfigure { hostname }
router.post('/reconfigure', requireAuth, (req, res) => {
  const { hostname } = req.body;
  if (!hostname) return res.status(400).json({ error: 'Hostname fehlt' });
  const state = readState();
  if (!state?.tunnelId) return res.status(400).json({ error: 'Kein Tunnel konfiguriert' });
  const bin = cfBin();
  if (!bin) return res.status(400).json({ error: 'cloudflared nicht installiert' });

  try {
    let config = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, 'utf8') : '';
    config = config.replace(/hostname: .+/, `hostname: ${hostname}`);
    fs.writeFileSync(CONFIG_PATH, config);

    let dnsOk = false;
    try {
      execSync(`"${bin}" tunnel route dns "${state.tunnelName}" "${hostname}"`, { timeout: 30000 });
      dnsOk = true;
    } catch {}

    const newState = writeState({ hostname, dnsOk });

    // Kill cloudflared — entrypoint loop restarts it with the updated config
    _restartTunnel();

    res.json({ ok: true, state: newState, dnsOk });
  } catch (e) {
    res.status(500).json({ error: 'Rekonfiguration fehlgeschlagen', detail: e.message });
  }
});

// ── Tunnel restart ─────────────────────────────────────────────────────
// Restart the cloudflared sidecar via Docker socket API.
// Docker (restart: always) immediately brings it back up with the new config.
function _restartTunnel() {
  // Docker socket API (primary — used when running in Docker Compose)
  try {
    execSync(
      'curl -sf -X POST --unix-socket /var/run/docker.sock "http://localhost/containers/campedel-cloudflared/restart?t=3"',
      { shell: true, timeout: 10000 }
    );
    return;
  } catch {}
  // Fallback: pkill (host-based deployments, no Docker socket)
  try { execSync('pkill -x cloudflared 2>/dev/null', { shell: true }); } catch {}
}

module.exports = router;
