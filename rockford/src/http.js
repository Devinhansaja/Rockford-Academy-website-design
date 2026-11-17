'use strict';
/* HTTP helpers: body parsing (urlencoded + multipart), cookies, responses, static files. */
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Read the raw request body, enforcing a byte limit. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > limit) { req.resume(); return reject(new HttpError(413, 'Request too large')); }
    const chunks = []; let size = 0; let done = false;
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > limit) { done = true; req.resume(); reject(new HttpError(413, 'Request too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks)); } });
    req.on('error', (e) => { if (!done) { done = true; reject(e); } });
  });
}

function parseUrlEncoded(buf) {
  const out = {};
  for (const [k, v] of new URLSearchParams(buf.toString('utf8'))) {
    if (k.endsWith('[]')) (out[k.slice(0, -2)] ||= []).push(v);
    else out[k] = v;
  }
  return out;
}

/** Minimal RFC 7578 multipart/form-data parser (in-memory; bodies are size-limited). */
function parseMultipart(buf, boundary) {
  const fields = {}; const files = [];
  const delim = Buffer.from('--' + boundary);
  let pos = buf.indexOf(delim);
  if (pos === -1) throw new HttpError(400, 'Malformed form data');
  pos += delim.length;
  while (pos < buf.length) {
    if (buf[pos] === 45 && buf[pos + 1] === 45) break; // closing "--"
    if (buf[pos] === 13 && buf[pos + 1] === 10) pos += 2;
    const headEnd = buf.indexOf('\r\n\r\n', pos);
    if (headEnd === -1) break;
    const headers = buf.slice(pos, headEnd).toString('utf8');
    const next = buf.indexOf(delim, headEnd + 4);
    if (next === -1) break;
    const data = buf.slice(headEnd + 4, next - 2); // strip trailing CRLF
    pos = next + delim.length;

    const disp = /content-disposition:\s*form-data;([^\r\n]*)/i.exec(headers);
    if (!disp) continue;
    const name = /\bname="([^"]*)"/i.exec(disp[1]);
    const filename = /\bfilename="([^"]*)"/i.exec(disp[1]);
    const ctype = /content-type:\s*([^\r\n;]+)/i.exec(headers);
    if (!name) continue;
    if (filename) {
      if (filename[1] === '' && data.length === 0) continue; // empty file input
      files.push({ field: name[1], filename: path.basename(filename[1].replace(/\\/g, '/')), mime: ctype ? ctype[1].trim().toLowerCase() : 'application/octet-stream', data });
    } else {
      const key = name[1]; const val = data.toString('utf8');
      if (key.endsWith('[]')) (fields[key.slice(0, -2)] ||= []).push(val);
      else fields[key] = val;
    }
  }
  return { fields, files };
}

/** Parse the request body according to its content type. */
async function parseBody(req, { limit = 64 * 1024 } = {}) {
  const type = String(req.headers['content-type'] || '');
  if (type.startsWith('multipart/form-data')) {
    const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(type);
    if (!m) throw new HttpError(400, 'Malformed form data');
    const buf = await readBody(req, limit);
    return parseMultipart(buf, (m[1] || m[2]).trim());
  }
  const buf = await readBody(req, limit);
  return { fields: parseUrlEncoded(buf), files: [] };
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) { try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore bad cookie */ } }
  }
  return out;
}

function cookie(name, value, { maxAge, httpOnly = true, sameSite = 'Lax', path: p = '/' } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${p}; SameSite=${sameSite}`;
  if (httpOnly) c += '; HttpOnly';
  if (config.cookieSecure) c += '; Secure';
  if (maxAge !== undefined) c += `; Max-Age=${Math.floor(maxAge)}`;
  return c;
}

function addCookie(res, c) {
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, c) : [c]);
}

function send(res, status, body, headers = {}) {
  if (res.headersSent) return;
  res.writeHead(status, headers);
  res.end(body);
}
const html = (res, body, status = 200, headers = {}) => send(res, status, body, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
const text = (res, body, status = 200, type = 'text/plain; charset=utf-8', headers = {}) => send(res, status, body, { 'Content-Type': type, ...headers });
const redirect = (res, location, status = 303) => send(res, status, '', { Location: location, 'Cache-Control': 'no-store' });

const MIME = {
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json',
};

/** Serve a file from /public. Returns true if handled. Never serves dotfiles or escapes the folder. */
function serveStatic(req, res, urlPath) {
  if (!urlPath.startsWith('/assets/') && !urlPath.startsWith('/uploads/') && urlPath !== '/favicon.svg') return false;
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch { return false; }
  if (rel.includes('\0') || rel.split('/').some((s) => s.startsWith('.'))) return false;
  const file = path.join(config.PUBLIC_DIR, rel);
  if (!file.startsWith(config.PUBLIC_DIR + path.sep)) return false;
  let st; try { st = fs.statSync(file); } catch { return false; }
  if (!st.isFile()) return false;
  const type = MIME[path.extname(file).toLowerCase()];
  if (!type) return false;
  const etag = `W/"${st.size}-${Math.floor(st.mtimeMs)}"`;
  const headers = {
    'Content-Type': type,
    'Content-Length': st.size,
    ETag: etag,
    'Cache-Control': urlPath.startsWith('/uploads/') ? 'public, max-age=2592000' : (config.isProd ? 'public, max-age=86400' : 'no-cache'),
    'X-Content-Type-Options': 'nosniff',
  };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return true; }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') { res.end(); return true; }
  fs.createReadStream(file).pipe(res);
  return true;
}

module.exports = { HttpError, readBody, parseBody, parseUrlEncoded, parseMultipart, parseCookies, cookie, addCookie, send, html, text, redirect, serveStatic };
