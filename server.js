require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3002;


// CORS FIRST
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.options('*', cors());

// Security headers (CSP disabled so admin dashboard JS works)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen, bitte später erneut versuchen.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anmeldeversuche, bitte in 15 Minuten erneut versuchen.' },
  skipSuccessfulRequests: true,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload-Limit erreicht, bitte in einer Stunde erneut versuchen.' },
});

app.use(globalLimiter);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded images
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR), {
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Serve admin dashboard
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));

// Serve other public assets (like /img and /favicon)
app.use('/img', express.static(path.join(__dirname, 'public', 'img')));
app.use('/favicon', express.static(path.join(__dirname, 'public', 'favicon')));

// API routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/drinks', require('./routes/drinks'));
app.use('/api/wines', require('./routes/wines'));
app.use('/api/import', require('./routes/importData'));
app.use('/api/upload', uploadLimiter, require('./routes/upload'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/tunnel', require('./routes/tunnel'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, version: '1.0.0' }));

// Root redirect to admin
app.get('/', (req, res) => res.redirect('/admin'));

app.listen(PORT, () => {
  console.log(`Campedèl Backend running on http://localhost:${PORT}`);
  console.log(`Admin Dashboard: http://localhost:${PORT}/admin`);
});
