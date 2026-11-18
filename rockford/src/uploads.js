'use strict';
/*
 * File upload validation and storage.
 *  - CVs (PDF/DOCX) are stored PRIVATELY in storage/cvs with random names, never under /public.
 *    They can only be downloaded through the authenticated admin route.
 *  - Images (JPG/PNG/WebP) uploaded by staff go to public/uploads/YYYY/MM/.
 * Type checks use the file extension AND the file's magic bytes; the browser's MIME type is ignored.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('./config');

const CV_DIR = path.join(config.DATA_DIR, 'cvs');

function detectCv(buf, filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf' && buf.slice(0, 5).toString('latin1') === '%PDF-') return { ext: '.pdf', mime: 'application/pdf' };
  if (ext === '.docx' && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    const s = buf.toString('latin1');
    if (s.includes('[Content_Types].xml') && s.includes('word/') && !s.includes('vbaProject.bin')) {
      return { ext: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    }
  }
  return null;
}

/** Returns { error } or { ok, kind }. */
function validateCv(file) {
  if (!file || !file.data || !file.data.length) return { error: 'Please attach your CV (PDF or Word .docx).' };
  if (file.data.length > config.cvMaxBytes) return { error: `Your CV must be ${Math.round(config.cvMaxBytes / 1048576)} MB or smaller.` };
  const kind = detectCv(file.data, file.filename || '');
  if (!kind) return { error: 'Your CV must be a PDF or Word (.docx) document.' };
  return { ok: true, kind };
}

function saveCv(file, kind) {
  const name = crypto.randomUUID() + kind.ext;
  fs.writeFileSync(path.join(CV_DIR, name), file.data, { mode: 0o600 });
  return { file: name, mime: kind.mime, size: file.data.length };
}

/** Absolute path of a stored CV, or null if the name is not a safe stored filename. */
function cvPath(name) {
  if (!/^[0-9a-f-]{36}\.(pdf|docx)$/.test(String(name))) return null;
  return path.join(CV_DIR, name);
}

function deleteCv(name) {
  const p = cvPath(name);
  if (p) { try { fs.unlinkSync(p); } catch { /* already gone */ } }
}

function detectImage(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: '.jpg', mime: 'image/jpeg' };
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: '.png', mime: 'image/png' };
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return { ext: '.webp', mime: 'image/webp' };
  return null;
}

function validateImage(file) {
  if (!file || !file.data || !file.data.length) return { error: 'Choose an image to upload.' };
  if (file.data.length > config.imageMaxBytes) return { error: `Images must be ${Math.round(config.imageMaxBytes / 1048576)} MB or smaller.` };
  const kind = detectImage(file.data);
  if (!kind) return { error: 'Images must be JPG, PNG or WebP.' };
  return { ok: true, kind };
}

/** Saves to public/uploads/YYYY/MM and returns { file (relative), url, mime, size }. */
function saveImage(file, kind) {
  const d = new Date();
  const sub = path.join(String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'));
  fs.mkdirSync(path.join(config.UPLOADS_DIR, sub), { recursive: true });
  const name = crypto.randomUUID() + kind.ext;
  fs.writeFileSync(path.join(config.UPLOADS_DIR, sub, name), file.data);
  const rel = `${sub.replace(/\\/g, '/')}/${name}`;
  return { file: rel, url: `/uploads/${rel}`, mime: kind.mime, size: file.data.length };
}

function deleteImage(rel) {
  if (!/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(String(rel))) return;
  try { fs.unlinkSync(path.join(config.UPLOADS_DIR, rel)); } catch { /* already gone */ }
}

/* ── Job flyers: an image (JPG/PNG/WebP) or a PDF, stored under public/uploads/flyers/YYYY/MM ── */
const FLYER_REL = /^flyers\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;
const flyerUrl = (rel) => (FLYER_REL.test(String(rel)) ? `/uploads/${rel}` : '');

function detectPdf(buf) {
  return buf.slice(0, 5).toString('latin1') === '%PDF-' ? { ext: '.pdf', mime: 'application/pdf' } : null;
}

/** kind is 'image' or 'pdf'. Returns { error } or { ok, kind: {ext, mime}, sha256 }. */
function validateFlyerFile(file, kind) {
  const label = kind === 'pdf' ? 'a PDF' : 'an image (JPG, PNG or WebP)';
  if (!file || !file.data || !file.data.length) return { error: `Choose ${label} to upload.` };
  if (file.data.length > config.flyerMaxBytes) return { error: `The file is too large. Flyers must be ${Math.round(config.flyerMaxBytes / 1048576)} MB or smaller.` };
  const found = kind === 'pdf' ? detectPdf(file.data) : detectImage(file.data);
  if (!found || (kind === 'pdf' && path.extname(file.filename || '').toLowerCase() !== '.pdf')) {
    return { error: kind === 'pdf' ? 'That file is not a PDF. Choose a .pdf file, or change the flyer type.' : 'That file is not a JPG, PNG or WebP image. Choose an image, or change the flyer type.' };
  }
  return { ok: true, kind: found, sha256: crypto.createHash('sha256').update(file.data).digest('hex') };
}

function saveFlyerFile(file, kind) {
  const d = new Date();
  const sub = `flyers/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  fs.mkdirSync(path.join(config.UPLOADS_DIR, sub), { recursive: true });
  const rel = `${sub}/${crypto.randomUUID()}${kind.ext}`;
  fs.writeFileSync(path.join(config.UPLOADS_DIR, rel), file.data);
  return { file: rel, mime: kind.mime, size: file.data.length };
}

function deleteFlyerFile(rel) {
  if (!FLYER_REL.test(String(rel))) return;
  const p = path.join(config.UPLOADS_DIR, rel);
  try { fs.unlinkSync(p); } catch { return; /* already gone */ }
  for (const dir of [path.dirname(p), path.dirname(path.dirname(p))]) { try { fs.rmdirSync(dir); } catch { break; /* not empty */ } }
}

module.exports = {
  validateCv, saveCv, cvPath, deleteCv, validateImage, saveImage, deleteImage, detectCv, detectImage,
  detectPdf, validateFlyerFile, saveFlyerFile, deleteFlyerFile, flyerUrl,
};
