'use strict';
/*
 * Backup: consistent snapshot of the database + private CVs + uploaded images.
 *   node scripts/backup.js                 → storage/backups/<timestamp>/
 *   node scripts/backup.js --keep 14       → also delete backups older than the newest 14
 *   node scripts/backup.js --out D:\backups → write somewhere else (recommended: off-server storage)
 * Restore: see docs/BACKUP-RESTORE.md.
 */
process.removeAllListeners('warning');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../src/config');
const { db } = require('../src/db');

const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
const outRoot = path.resolve(arg('--out') || path.join(config.DATA_DIR, 'backups'));
const keep = Number(arg('--keep') || 0);

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dest = path.join(outRoot, stamp);
fs.mkdirSync(dest, { recursive: true });

// 1. Database: VACUUM INTO produces a consistent copy even while the site is running.
db.exec(`VACUUM INTO '${path.join(dest, 'rockford.db').replace(/'/g, "''")}'`);

// 2. Files
const copyDir = (from, to) => {
  if (!fs.existsSync(from)) return 0;
  let n = 0;
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name); const b = path.join(to, e.name);
    if (e.isDirectory()) n += copyDir(a, b); else { fs.copyFileSync(a, b); n++; }
  }
  return n;
};
const cvs = copyDir(path.join(config.DATA_DIR, 'cvs'), path.join(dest, 'cvs'));
const uploads = copyDir(config.UPLOADS_DIR, path.join(dest, 'uploads'));

fs.writeFileSync(path.join(dest, 'MANIFEST.txt'), [
  'Rockford Academy backup',
  `Created: ${new Date().toISOString()}`,
  `Database: rockford.db`,
  `CV files: ${cvs}`,
  `Uploaded images: ${uploads}`,
  'Contains personal data (job applications and enquiries). Store encrypted and restrict access.',
].join('\n'));

if (keep > 0) {
  const all = fs.readdirSync(outRoot).filter((d) => /^\d{4}-\d{2}-\d{2}T/.test(d)).sort();
  for (const old of all.slice(0, Math.max(0, all.length - keep))) fs.rmSync(path.join(outRoot, old), { recursive: true, force: true });
}

console.log(`Backup written to ${dest} (cvs: ${cvs}, uploads: ${uploads})`);
