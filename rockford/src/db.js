'use strict';
/*
 * SQLite database (Node built-in `node:sqlite`). Schema is versioned with
 * PRAGMA user_version; add new migrations to the end of MIGRATIONS only.
 */
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

const db = new DatabaseSync(path.join(config.DATA_DIR, 'rockford.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

const MIGRATIONS = [
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','editor','recruiter')),
    pass_hash TEXT NOT NULL,
    totp_secret TEXT,
    failed_logins INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER,
    last_login_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf TEXT NOT NULL,
    pending_2fa INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE programmes (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT '',
    age_group TEXT NOT NULL DEFAULT '',
    duration TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    objectives TEXT NOT NULL DEFAULT '[]',
    entry_requirements TEXT NOT NULL DEFAULT '',
    schedule TEXT NOT NULL DEFAULT '',
    availability TEXT NOT NULL DEFAULT 'coming_soon' CHECK (availability IN ('coming_soon','enrolling','waitlist','closed')),
    image_url TEXT NOT NULL DEFAULT '',
    image_alt TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    seo_title TEXT NOT NULL DEFAULT '',
    seo_description TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE vacancies (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    responsibilities TEXT NOT NULL DEFAULT '[]',
    qualifications TEXT NOT NULL DEFAULT '[]',
    employment_type TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    deadline TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed','archived')),
    seo_title TEXT NOT NULL DEFAULT '',
    seo_description TEXT NOT NULL DEFAULT '',
    published_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE applications (
    id INTEGER PRIMARY KEY,
    ref TEXT NOT NULL UNIQUE,
    vacancy_id INTEGER REFERENCES vacancies(id) ON DELETE SET NULL,
    position TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    qualifications TEXT NOT NULL,
    experience TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    cv_file TEXT NOT NULL,
    cv_name TEXT NOT NULL,
    cv_mime TEXT NOT NULL,
    cv_size INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','reviewing','shortlisted','unsuccessful','hired','withdrawn')),
    notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    retention_until INTEGER NOT NULL
  );
  CREATE INDEX idx_app_vacancy ON applications(vacancy_id);
  CREATE INDEX idx_app_created ON applications(created_at);

  CREATE TABLE enquiries (
    id INTEGER PRIMARY KEY,
    ref TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('general','programme','careers')),
    programme_id INTEGER REFERENCES programmes(id) ON DELETE SET NULL,
    topic TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','closed')),
    created_at INTEGER NOT NULL,
    retention_until INTEGER NOT NULL
  );

  CREATE TABLE articles (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    image_alt TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    seo_title TEXT NOT NULL DEFAULT '',
    seo_description TEXT NOT NULL DEFAULT '',
    published_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE testimonials (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    quote TEXT NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    video_url TEXT NOT NULL DEFAULT '',
    consent_confirmed INTEGER NOT NULL DEFAULT 0,
    approved_by TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    sort INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE media (
    id INTEGER PRIMARY KEY,
    file TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    alt TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  `,
  /* 2: job flyers (an image, a PDF or typed words), shown on the Careers page */
  `
  CREATE TABLE flyers (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('image','pdf','text')),
    summary TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    file TEXT NOT NULL DEFAULT '',
    original_name TEXT NOT NULL DEFAULT '',
    mime TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    sha256 TEXT NOT NULL DEFAULT '',
    alt TEXT NOT NULL DEFAULT '',
    deadline TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    sort INTEGER NOT NULL DEFAULT 0,
    published_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX idx_flyers_sha ON flyers(sha256);
  `,
  /* 3: flyers can also be Word documents (rebuild the table to widen the kind check) */
  `
  CREATE TABLE flyers_new (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('image','pdf','doc','text')),
    summary TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    file TEXT NOT NULL DEFAULT '',
    original_name TEXT NOT NULL DEFAULT '',
    mime TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    sha256 TEXT NOT NULL DEFAULT '',
    alt TEXT NOT NULL DEFAULT '',
    deadline TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    sort INTEGER NOT NULL DEFAULT 0,
    published_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  INSERT INTO flyers_new SELECT id, title, kind, summary, body, file, original_name, mime, size, sha256, alt, deadline, status, sort, published_at, created_at, updated_at FROM flyers;
  DROP TABLE flyers;
  ALTER TABLE flyers_new RENAME TO flyers;
  CREATE INDEX idx_flyers_sha ON flyers(sha256);
  `,
];


function migrate() {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}
migrate();

const now = () => Date.now();

/** Small query helpers. Always use placeholders; never interpolate user input into SQL. */
const q = {
  get: (sql, ...p) => db.prepare(sql).get(...p),
  all: (sql, ...p) => db.prepare(sql).all(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
};

function audit(userId, action, detail = '') {
  q.run('INSERT INTO audit_log (user_id, action, detail, created_at) VALUES (?, ?, ?, ?)', userId || null, action, String(detail).slice(0, 500), now());
}

/** Turn a title into a URL slug that is unique within `table`. */
function uniqueSlug(table, title, excludeId) {
  if (!['programmes', 'vacancies', 'articles'].includes(table)) throw new Error('bad table');
  const base = String(title).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';
  let slug = base;
  for (let i = 2; ; i++) {
    const row = q.get(`SELECT id FROM ${table} WHERE slug = ?`, slug);
    if (!row || row.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}

module.exports = { db, q, now, audit, uniqueSlug };
