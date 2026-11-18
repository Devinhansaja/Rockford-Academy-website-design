'use strict';
/*
 * Configuration. Values come from environment variables, optionally loaded
 * from a `.env` file in the project root (see `.env.example`).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv(path.join(ROOT, '.env'));

const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);
const bool = (k, d) => { const v = env(k); return v === undefined ? d : /^(1|true|yes|on)$/i.test(v); };
const num = (k, d) => { const v = Number(env(k)); return Number.isFinite(v) && env(k) !== undefined ? v : d; };

const DATA_DIR = path.resolve(ROOT, env('DATA_DIR', 'storage'));
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const d of ['cvs', 'outbox', 'backups']) fs.mkdirSync(path.join(DATA_DIR, d), { recursive: true });
const UPLOADS_DIR = path.join(ROOT, 'public', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const isProd = env('NODE_ENV', 'development') === 'production';

// Session secret: required in production; generated and persisted for local development.
let secret = env('SESSION_SECRET');
if (!secret) {
  if (isProd) throw new Error('SESSION_SECRET must be set in production (see .env.example).');
  const f = path.join(DATA_DIR, '.dev-secret');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  secret = fs.readFileSync(f, 'utf8').trim();
}

module.exports = {
  ROOT,
  DATA_DIR,
  UPLOADS_DIR,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  isProd,
  port: num('PORT', 3000),
  host: env('HOST', '127.0.0.1'),
  siteUrl: (env('SITE_URL', '') || '').replace(/\/+$/, ''), // canonical origin, e.g. https://rockfordacademy.com
  trustProxy: bool('TRUST_PROXY', false),
  cookieSecure: bool('COOKIE_SECURE', isProd),
  secret,
  cvMaxBytes: Math.round(num('CV_MAX_MB', 5) * 1024 * 1024),
  imageMaxBytes: Math.round(num('IMAGE_MAX_MB', 4) * 1024 * 1024),
  flyerMaxBytes: Math.round(num('FLYER_MAX_MB', 8) * 1024 * 1024), // job flyers (image or PDF)
  mail: {
    transport: env('MAIL_TRANSPORT', 'outbox'), // 'outbox' (no delivery, saved to storage/outbox) | 'smtp'
    from: env('MAIL_FROM', ''),
    host: env('SMTP_HOST', ''),
    port: num('SMTP_PORT', 587),
    secure: bool('SMTP_SECURE', false), // true = implicit TLS (465); false = STARTTLS (587)
    user: env('SMTP_USER', ''),
    pass: env('SMTP_PASS', ''),
  },
};
