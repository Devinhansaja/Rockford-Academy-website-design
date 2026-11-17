'use strict';
/* Escaping, passwords, sessions, CSRF, public form tokens, rate limiting, TOTP 2FA. */
const crypto = require('node:crypto');
const config = require('./config');
const { q, now } = require('./db');
const { parseCookies, cookie, addCookie } = require('./http');

/* ── Output escaping ─────────────────────────────────────────── */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const h = (v) => (v === undefined || v === null ? '' : String(v).replace(/[&<>"']/g, (c) => ESC[c]));

/** Only allow http(s), mailto, tel and site-relative URLs in href/src attributes. */
function safeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  return '';
}

/* ── Passwords (scrypt) ──────────────────────────────────────── */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${key.toString('base64')}`;
}
function verifyPassword(pw, stored) {
  const [alg, N, r, p, salt, key] = String(stored || '').split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(key, 'base64');
  const got = crypto.scryptSync(String(pw), Buffer.from(salt, 'base64'), expected.length, { N: +N, r: +r, p: +p });
  return crypto.timingSafeEqual(expected, got);
}
function passwordProblem(pw) {
  if (String(pw).length < 12) return 'Use at least 12 characters.';
  if (!/[a-z]/i.test(pw) || !/[0-9]/.test(pw)) return 'Use a mix of letters and numbers.';
  return '';
}

/* ── Sessions ────────────────────────────────────────────────── */
const SESSION_COOKIE = 'rf_session';
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

function createSession(res, userId, { pending2fa = false } = {}) {
  const id = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  q.run('INSERT INTO sessions (id, user_id, csrf, pending_2fa, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, userId, csrf, pending2fa ? 1 : 0, now() + SESSION_TTL, now());
  addCookie(res, cookie(SESSION_COOKIE, id, { maxAge: SESSION_TTL / 1000 }));
  return { id, csrf };
}

function getSession(req) {
  const id = parseCookies(req)[SESSION_COOKIE];
  if (!id) return null;
  const s = q.get(`SELECT s.id, s.csrf, s.pending_2fa, s.expires_at, u.id AS user_id, u.email, u.name, u.role, u.totp_secret
                   FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`, id);
  if (!s) return null;
  if (s.expires_at < now()) { q.run('DELETE FROM sessions WHERE id = ?', id); return null; }
  return s;
}

function destroySession(req, res) {
  const id = parseCookies(req)[SESSION_COOKIE];
  if (id) q.run('DELETE FROM sessions WHERE id = ?', id);
  addCookie(res, cookie(SESSION_COOKIE, '', { maxAge: 0 }));
}

function purgeExpiredSessions() { q.run('DELETE FROM sessions WHERE expires_at < ?', now()); }

function safeEqual(a, b) {
  const A = Buffer.from(String(a || '')); const B = Buffer.from(String(b || ''));
  return A.length === B.length && A.length > 0 && crypto.timingSafeEqual(A, B);
}
const verifyCsrf = (session, token) => !!session && safeEqual(session.csrf, token);

/* ── Public form tokens (CSRF + time trap, no session needed) ─── */
function formToken() {
  const ts = Date.now().toString(36);
  const nonce = crypto.randomBytes(9).toString('base64url');
  const mac = crypto.createHmac('sha256', config.secret).update(`${ts}.${nonce}`).digest('base64url').slice(0, 32);
  return `${ts}.${nonce}.${mac}`;
}
/** Returns '' when valid, otherwise a reason code. Rejects tokens submitted too fast (bots) or too late. */
function checkFormToken(token, { minMs = 2500, maxMs = 4 * 60 * 60 * 1000 } = {}) {
  const [ts, nonce, mac] = String(token || '').split('.');
  if (!ts || !nonce || !mac) return 'missing';
  const expect = crypto.createHmac('sha256', config.secret).update(`${ts}.${nonce}`).digest('base64url').slice(0, 32);
  if (!safeEqual(expect, mac)) return 'invalid';
  const age = Date.now() - parseInt(ts, 36);
  if (age < minMs) return 'too_fast';
  if (age > maxMs) return 'expired';
  return '';
}

/* ── Rate limiting (in-memory, per process) ──────────────────── */
const buckets = new Map();
/** Returns true if the action is allowed. */
function rateLimit(key, max, windowMs) {
  const t = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < t) { buckets.set(key, { count: 1, reset: t + windowMs }); return true; }
  b.count += 1;
  return b.count <= max;
}
setInterval(() => { const t = Date.now(); for (const [k, b] of buckets) if (b.reset < t) buckets.delete(k); }, 60_000).unref();

function clientIp(req) {
  if (config.trustProxy) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xff) return xff;
  }
  return req.socket.remoteAddress || 'unknown';
}

/* ── References ──────────────────────────────────────────────── */
function reference(prefix) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `${prefix}-${new Date().getFullYear()}-${s}`;
}

/* ── TOTP (RFC 6238) for optional two-factor authentication ──── */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buf) {
  let bits = 0; let value = 0; let out = '';
  for (const byte of buf) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0; let value = 0; const out = [];
  for (const ch of clean) { value = (value << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
const newTotpSecret = () => base32Encode(crypto.randomBytes(20));
function totpAt(secret, counter) {
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const off = hmac[hmac.length - 1] & 15;
  const code = ((hmac.readUInt32BE(off) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
  return code;
}
function verifyTotp(secret, code) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c) || !secret) return false;
  const step = Math.floor(Date.now() / 30000);
  for (const d of [-1, 0, 1]) if (safeEqual(totpAt(secret, step + d), c)) return true;
  return false;
}
const totpUri = (secret, email) => `otpauth://totp/${encodeURIComponent('Rockford Academy:' + email)}?secret=${secret}&issuer=${encodeURIComponent('Rockford Academy')}`;

module.exports = {
  h, safeUrl, hashPassword, verifyPassword, passwordProblem,
  createSession, getSession, destroySession, purgeExpiredSessions, verifyCsrf, safeEqual,
  formToken, checkFormToken, rateLimit, clientIp, reference,
  newTotpSecret, verifyTotp, totpAt, totpUri,
};
