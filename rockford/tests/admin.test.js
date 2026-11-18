'use strict';
/*
 * End-to-end tests for the admin panel. Spawns the real server on a free port with its own
 * temporary DATA_DIR (deleted afterwards), then drives it with fetch, keeping cookies by hand.
 *   node --test tests/
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rockford-admin-test-'));
const ADMIN = { name: 'Test Admin', email: 'admin@example.test', password: 'correct horse 123' };
let server; let base; let security; let db; let settingsDefaults;

/* ── Helpers ─────────────────────────────────────────────────── */
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on('error', reject);
  });
}

/** A real 1×1 PNG. */
function tinyPng() {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const idat = zlib.deflateSync(Buffer.from([0, 0xd9, 0xa4, 0x41]));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
const tinyPdf = () => Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');

class Client {
  constructor() { this.cookie = ''; this.csrf = ''; }
  async req(method, p, { form, fd, headers = {} } = {}) {
    const h = { ...headers };
    if (this.cookie) h.cookie = this.cookie;
    let body;
    if (form) { h['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
    if (fd) body = fd;
    const r = await fetch(base + p, { method, headers: h, body, redirect: 'manual' });
    for (const c of r.headers.getSetCookie()) {
      const [kv] = c.split(';');
      if (kv.startsWith('rf_session=')) this.cookie = /Max-Age=0/i.test(c) ? '' : kv;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const res = { status: r.status, headers: r.headers, location: r.headers.get('location'), buf, text: buf.toString('utf8') };
    const m = /name="_csrf" value="([^"]+)"/.exec(res.text);
    if (m) this.csrf = m[1];
    return res;
  }
  get(p) { return this.req('GET', p); }
  /** POST a urlencoded form; adds the session CSRF token unless the form sets _csrf itself. */
  post(p, form = {}, { csrf = true } = {}) { return this.req('POST', p, { form: csrf && !('_csrf' in form) ? { _csrf: this.csrf, ...form } : form }); }
  async login(email, password, next = '') {
    const page = await this.get('/admin/login');
    const token = /name="_token" value="([^"]+)"/.exec(page.text)[1];
    return this.req('POST', '/admin/login', { form: { _token: token, email, password, next } });
  }
}
const idFrom = (loc) => Number(/\/(\d+)\?/.exec(loc)[1]);
const row = (sql, ...p) => db.q.get(sql, ...p);

/* ── Server lifecycle ────────────────────────────────────────── */
before(async () => {
  const env = { ...process.env, DATA_DIR, NODE_ENV: 'development', HOST: '127.0.0.1', MAIL_TRANSPORT: 'outbox', SITE_URL: '', ADMIN_SCOPE: 'full' };
  const made = spawnSync(process.execPath, ['scripts/create-admin.js', '--name', ADMIN.name, '--email', ADMIN.email, '--password', ADMIN.password], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
  const weak = spawnSync(process.execPath, ['scripts/create-admin.js', '--name', 'X', '--email', 'x@example.test', '--password', 'short'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.notEqual(weak.status, 0, 'weak password must be rejected by create-admin');

  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let errOut = '';
  server.stderr.on('data', (d) => { errOut += d; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start: ' + errOut)), 15000);
    server.stdout.on('data', (d) => { if (/running at/.test(String(d))) { clearTimeout(timer); resolve(); } });
    server.on('exit', (code) => { clearTimeout(timer); reject(new Error(`server exited (${code}): ${errOut}`)); });
  });
  process.env.DATA_DIR = DATA_DIR;
  security = require('../src/security');
  db = require('../src/db');
  settingsDefaults = require('../src/settings').DEFAULTS;
});

after(async () => {
  if (server && server.exitCode === null) {
    const exited = new Promise((r) => server.once('exit', r));
    server.kill();
    await exited;
  }
  try { db && db.db.close(); } catch { /* ignore */ }
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

/* ── Tests ───────────────────────────────────────────────────── */
test('admin panel', async (t) => {
  const admin = new Client();

  await t.test('requires sign-in and sends noindex', async () => {
    const r = await new Client().get('/admin/programmes');
    assert.equal(r.status, 303);
    assert.equal(r.location, '/admin/login?next=%2Fadmin%2Fprogrammes');
    assert.match(r.headers.get('x-robots-tag'), /noindex/);
    const login = await new Client().get('/admin/login');
    assert.match(login.text, /<meta name="robots" content="noindex/);
  });

  await t.test('login: bad password, good password, safe next', async () => {
    const bad = await new Client().login(ADMIN.email, 'wrong password 1');
    assert.equal(bad.status, 401);
    assert.match(bad.text, /Email or password is incorrect/);
    const unknown = await new Client().login('nobody@example.test', 'whatever 12345');
    assert.equal(unknown.status, 401);
    assert.match(unknown.text, /Email or password is incorrect/);
    const noToken = await new Client().req('POST', '/admin/login', { form: { email: ADMIN.email, password: ADMIN.password } });
    assert.equal(noToken.status, 400);

    const ok = await admin.login(ADMIN.email, ADMIN.password);
    assert.equal(ok.status, 303);
    assert.equal(ok.location, '/admin');
    assert.ok(row('SELECT last_login_at FROM users WHERE email = ?', ADMIN.email).last_login_at);
    const evil = await new Client().login(ADMIN.email, ADMIN.password, 'https://evil.example/admin');
    assert.equal(evil.location, '/admin');
    const good = await new Client().login(ADMIN.email, ADMIN.password, '/admin/vacancies');
    assert.equal(good.location, '/admin/vacancies');
  });

  await t.test('dashboard shows counts and honest checklist', async () => {
    const r = await admin.get('/admin');
    assert.equal(r.status, 200);
    assert.match(r.text, /New applications/);
    assert.match(r.text, /Setup checklist/);
    assert.match(r.text, /Email delivery is not configured/);
    assert.match(r.text, /SITE_URL is not set/);
    assert.match(r.text, /No contact details/);
    assert.match(r.text, /Legal pages are still drafts/);
    assert.match(r.text, /stock photos? still in use/);
    assert.match(r.text, /not turned on two-factor/);
    assert.match(r.text, /Notification recipients are missing/);
  });

  await t.test('CSRF: POST without or with a wrong token is rejected', async () => {
    const none = await admin.post('/admin/programmes/new', { title: 'X' }, { csrf: false });
    assert.equal(none.status, 403);
    const wrong = await admin.post('/admin/programmes/new', { _csrf: 'nope', title: 'X' });
    assert.equal(wrong.status, 403);
    assert.equal(row("SELECT COUNT(*) AS n FROM programmes").n, 0);
  });

  await t.test('programmes CRUD, validation, publish toggle, delete', async () => {
    let r = await admin.post('/admin/programmes/new', { title: '', status: 'draft', availability: 'coming_soon' });
    assert.equal(r.status, 422);
    assert.match(r.text, /Title is required/);
    r = await admin.post('/admin/programmes/new', { title: 'Bad', slug: 'Bad Slug!', status: 'draft', availability: 'coming_soon' });
    assert.equal(r.status, 422);
    assert.match(r.text, /lowercase letters/);
    assert.match(r.text, /value="Bad Slug!"/, 'form re-rendered with submitted values');
    r = await admin.post('/admin/programmes/new', { title: 'Img', image_url: 'javascript:alert(1)', status: 'draft', availability: 'coming_soon' });
    assert.equal(r.status, 422);
    r = await admin.post('/admin/programmes/new', { title: 'Bad status', status: 'live', availability: 'coming_soon' });
    assert.equal(r.status, 422);

    r = await admin.post('/admin/programmes/new', {
      title: 'Public Speaking <Basics>', excerpt: 'Speak up', body: '## Hello\nWorld', format: 'Online', objectives: 'Confidence\n\n Clarity ',
      availability: 'enrolling', status: 'draft', sort: '2', image_url: '/uploads/2026/11/x.jpg', image_alt: 'A stage',
    });
    assert.equal(r.status, 303, r.text.slice(0, 500));
    const id = idFrom(r.location);
    const p = row('SELECT * FROM programmes WHERE id = ?', id);
    assert.equal(p.slug, 'public-speaking-basics');
    assert.deepEqual(JSON.parse(p.objectives), ['Confidence', 'Clarity']);
    assert.equal(p.sort, 2);
    const edit = await admin.get(`/admin/programmes/${id}`);
    assert.match(edit.text, /Public Speaking &lt;Basics&gt;/);
    assert.doesNotMatch(edit.text, /<Basics>/);

    r = await admin.post('/admin/programmes/new', { title: 'Other', slug: 'public-speaking-basics', status: 'draft', availability: 'coming_soon' });
    assert.equal(r.status, 422);
    assert.match(r.text, /already uses this URL slug/);

    r = await admin.post(`/admin/programmes/${id}`, { title: 'Public Speaking', slug: 'public-speaking', status: 'published', availability: 'waitlist', objectives: 'A' });
    assert.equal(r.status, 303);
    assert.equal(row('SELECT status FROM programmes WHERE id = ?', id).status, 'published');
    r = await admin.post(`/admin/programmes/${id}/status`, { status: 'draft' });
    assert.equal(r.status, 303);
    assert.equal(row('SELECT status, slug FROM programmes WHERE id = ?', id).status, 'draft');
    const list = await admin.get('/admin/programmes');
    assert.match(list.text, /Public Speaking/);
    r = await admin.post(`/admin/programmes/${id}/delete`);
    assert.equal(r.location, '/admin/programmes?deleted=1');
    assert.equal(row('SELECT id FROM programmes WHERE id = ?', id), undefined);
    assert.equal((await admin.get(`/admin/programmes/${id}`)).status, 404);
    assert.equal((await admin.get('/admin/programmes/abc')).status, 404);
  });

  let vacancyId;
  await t.test('vacancies: open sets published_at, quick actions, date validation', async () => {
    let r = await admin.post('/admin/vacancies/new', { title: 'English Trainer', employment_type: 'Full-time', deadline: '2026-02-30', status: 'draft' });
    assert.equal(r.status, 422);
    assert.match(r.text, /valid date/);
    r = await admin.post('/admin/vacancies/new', { title: 'English Trainer', employment_type: 'Freelance', status: 'draft' });
    assert.equal(r.status, 422);
    r = await admin.post('/admin/vacancies/new', { title: 'English Trainer', employment_type: 'Full-time', deadline: '2026-12-31', status: 'draft', responsibilities: 'Teach\nMentor', qualifications: 'Degree' });
    assert.equal(r.status, 303);
    vacancyId = idFrom(r.location);
    assert.equal(row('SELECT published_at FROM vacancies WHERE id = ?', vacancyId).published_at, null);
    r = await admin.post(`/admin/vacancies/${vacancyId}/status`, { status: 'open' });
    assert.equal(r.status, 303);
    const v = row('SELECT * FROM vacancies WHERE id = ?', vacancyId);
    assert.equal(v.status, 'open');
    assert.ok(v.published_at);
    assert.deepEqual(JSON.parse(v.responsibilities), ['Teach', 'Mentor']);
    for (const s of ['closed', 'archived', 'open']) {
      r = await admin.post(`/admin/vacancies/${vacancyId}/status`, { status: s });
      assert.equal(r.status, 303);
      assert.equal(row('SELECT status FROM vacancies WHERE id = ?', vacancyId).status, s);
    }
    assert.equal(row('SELECT published_at FROM vacancies WHERE id = ?', vacancyId).published_at, v.published_at, 'published_at kept');
    r = await admin.post(`/admin/vacancies/${vacancyId}/status`, { status: 'bogus' });
    assert.equal(r.status, 400);
    const list = await admin.get('/admin/vacancies');
    assert.match(list.text, new RegExp(`/admin/applications\\?vacancy=${vacancyId}`));
  });

  await t.test('articles: published_at defaults to now and is editable', async () => {
    let r = await admin.post('/admin/articles/new', { title: 'Opening day', body: 'Hello', status: 'published', published_at: '' });
    assert.equal(r.status, 303);
    const id = idFrom(r.location);
    assert.ok(Math.abs(row('SELECT published_at FROM articles WHERE id = ?', id).published_at - Date.now()) < 60000);
    r = await admin.post(`/admin/articles/${id}`, { title: 'Opening day', slug: 'opening-day', status: 'published', published_at: '2026-01-15' });
    assert.equal(r.status, 303);
    assert.equal(row('SELECT published_at FROM articles WHERE id = ?', id).published_at, Date.parse('2026-01-15T00:00:00+05:30'));
    const edit = await admin.get(`/admin/articles/${id}`);
    assert.match(edit.text, /value="2026-01-15"/);
    r = await admin.post('/admin/articles/new', { title: 'Draft one', status: 'draft' });
    assert.equal(row('SELECT published_at FROM articles WHERE id = ?', idFrom(r.location)).published_at, null);
  });

  await t.test('testimonials: consent rule and video URL rule', async () => {
    let r = await admin.post('/admin/testimonials/new', { name: 'Amaya', quote: 'Great!', status: 'published' });
    assert.equal(r.status, 422);
    assert.match(r.text, /only be published after written consent/);
    r = await admin.post('/admin/testimonials/new', { name: 'Amaya', quote: 'Great!', status: 'published', consent_confirmed: '1' });
    assert.equal(r.status, 422, 'approver also required');
    r = await admin.post('/admin/testimonials/new', { name: 'Amaya', quote: 'Great!', status: 'draft', video_url: 'https://evil.example/embed/x' });
    assert.equal(r.status, 422);
    assert.match(r.text, /YouTube embed link/);
    r = await admin.post('/admin/testimonials/new', { name: 'Amaya', quote: 'Great!', status: 'draft', video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' });
    assert.equal(r.status, 303);
    const id = idFrom(r.location);
    assert.equal(row('SELECT video_url FROM testimonials WHERE id = ?', id).video_url, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    r = await admin.post(`/admin/testimonials/${id}/status`, { status: 'published' });
    assert.equal(r.status, 422);
    assert.equal(row('SELECT status FROM testimonials WHERE id = ?', id).status, 'draft');
    r = await admin.post(`/admin/testimonials/${id}`, { name: 'Amaya', quote: 'Great!', status: 'published', consent_confirmed: '1', approved_by: 'Principal' });
    assert.equal(r.status, 303);
    assert.equal(row('SELECT status, consent_confirmed FROM testimonials WHERE id = ?', id).status, 'published');
  });

  await t.test('media library: upload, list, alt edit, reject non-image, delete', async () => {
    await admin.get('/admin/media');
    const fd = new FormData();
    fd.append('_csrf', admin.csrf);
    fd.append('alt', 'A tiny gold square');
    fd.append('file', new Blob([tinyPng()], { type: 'image/png' }), 'tiny square.png');
    let r = await admin.req('POST', '/admin/media', { fd });
    assert.equal(r.status, 303, r.text.slice(0, 300));
    const m = row('SELECT * FROM media ORDER BY id DESC LIMIT 1');
    assert.equal(m.alt, 'A tiny gold square');
    assert.equal(m.mime, 'image/png');
    const file = path.join(ROOT, 'public', 'uploads', m.file);
    assert.ok(fs.existsSync(file));
    const img = await new Client().get(`/uploads/${m.file}`);
    assert.equal(img.status, 200);
    const page = await admin.get('/admin/media');
    assert.match(page.text, new RegExp(`/uploads/${m.file}`));

    const bad = new FormData();
    bad.append('_csrf', admin.csrf); bad.append('alt', 'x');
    bad.append('file', new Blob([Buffer.from('<svg onload=alert(1)>')], { type: 'image/png' }), 'evil.png');
    r = await admin.req('POST', '/admin/media', { fd: bad });
    assert.equal(r.status, 422);
    assert.match(r.text, /JPG, PNG or WebP/);
    const noCsrf = new FormData(); noCsrf.append('alt', 'x'); noCsrf.append('file', new Blob([tinyPng()]), 'a.png');
    assert.equal((await admin.req('POST', '/admin/media', { fd: noCsrf })).status, 403);

    r = await admin.post(`/admin/media/${m.id}`, { alt: '' });
    assert.equal(r.status, 422);
    r = await admin.post(`/admin/media/${m.id}`, { alt: 'New alt' });
    assert.equal(r.status, 303);
    assert.equal(row('SELECT alt FROM media WHERE id = ?', m.id).alt, 'New alt');
    r = await admin.post(`/admin/media/${m.id}/delete`);
    assert.equal(r.status, 303);
    assert.ok(!fs.existsSync(file));
    assert.equal(row('SELECT id FROM media WHERE id = ?', m.id), undefined);
    for (const dir of [path.dirname(file), path.dirname(path.dirname(file))]) { try { fs.rmdirSync(dir); } catch { /* not empty */ } }
  });

  await t.test('job flyers: image, PDF and words-only flyers; validation; duplicates; publish; delete', async () => {
    const pub = new Client();
    const flyerDir = path.join(ROOT, 'public', 'uploads', 'flyers');
    const filesOnDisk = () => (fs.existsSync(flyerDir) ? fs.readdirSync(flyerDir, { recursive: true }).filter((f) => /\.(png|jpg|webp|pdf)$/.test(f)).length : 0);
    const png = (n) => Buffer.concat([tinyPng(), Buffer.from(`variant-${n}`)]);
    const pdf = (n) => Buffer.concat([tinyPdf(), Buffer.from(`% variant ${n}\n`)]);
    const send = (url, fields, file) => {
      const fd = new FormData();
      fd.append('_csrf', admin.csrf);
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      if (file) fd.append('file', new Blob([file.data], { type: file.type || 'application/octet-stream' }), file.name);
      return admin.req('POST', url, { fd });
    };
    const publicHas = async (re) => re.test((await pub.get('/careers')).text);

    let r = await admin.get('/admin/flyers');
    assert.equal(r.status, 200);
    assert.match(r.text, /No flyers yet/);
    assert.match(r.text, /Job Flyers/);
    assert.equal(await publicHas(/id="flyers"/), false, 'no flyer section while there are no flyers');
    r = await admin.get('/admin/flyers/new');
    assert.equal(r.status, 200);
    assert.match(r.text, /data-flyer-form/);
    assert.match(r.text, /Words only/);

    /* 1. Image flyer */
    r = await send('/admin/flyers/new', { kind: 'image', title: 'English Tutor – Colombo', summary: 'Join our teaching team', alt: 'Flyer: English tutor wanted in Colombo', status: 'published' }, { data: png(1), type: 'image/png', name: 'tutor.png' });
    assert.equal(r.status, 303, r.text.slice(0, 500));
    const img = row("SELECT * FROM flyers WHERE kind = 'image'");
    assert.match(img.file, /^flyers\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    assert.equal(img.mime, 'image/png');
    assert.equal(img.status, 'published');
    assert.ok(img.published_at);
    assert.ok(fs.existsSync(path.join(ROOT, 'public', 'uploads', img.file)));
    r = await pub.get(`/uploads/${img.file}`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/png');

    /* 2. PDF flyer */
    r = await send('/admin/flyers/new', { kind: 'pdf', title: 'Receptionist vacancy', summary: 'Front desk role', status: 'published' }, { data: pdf(1), type: 'application/pdf', name: 'reception.pdf' });
    assert.equal(r.status, 303, r.text.slice(0, 500));
    const pdfRow = row("SELECT * FROM flyers WHERE kind = 'pdf'");
    assert.match(pdfRow.file, /\.pdf$/);
    assert.equal(pdfRow.original_name, 'reception.pdf');
    r = await pub.get(`/uploads/${pdfRow.file}`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.match(r.headers.get('content-disposition'), /inline/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(r.buf.slice(0, 5).toString() === '%PDF-');

    /* 3. Words-only flyer (markdown text; HTML must be escaped) */
    r = await send('/admin/flyers/new', { kind: 'text', title: 'Visiting Lecturer Wanted', summary: 'Part-time', body: '## Duties\n\n- Teach spoken English\n- Run workshops\n\nSend your CV to <script>alert(1)</script> careers.', status: 'published', sort: '5' });
    assert.equal(r.status, 303, r.text.slice(0, 500));
    const txt = row("SELECT * FROM flyers WHERE kind = 'text'");
    assert.equal(txt.file, '');
    assert.equal(txt.sort, 5);
    assert.equal(filesOnDisk(), 2, 'a words-only flyer stores no file');

    /* Public Careers page shows all three types */
    const careers = (await pub.get('/careers')).text;
    assert.match(careers, /id="flyers"/);
    assert.ok(careers.includes(`src="/uploads/${img.file}"`));
    assert.ok(careers.includes('alt="Flyer: English tutor wanted in Colombo"'));
    assert.ok(careers.includes('English Tutor – Colombo'));
    assert.match(careers, /Open PDF/);
    assert.ok(careers.includes(`href="/uploads/${pdfRow.file}"`));
    assert.match(careers, /<li>Teach spoken English<\/li>/);
    assert.doesNotMatch(careers, /<script>alert\(1\)<\/script>/);
    assert.ok(careers.indexOf('Visiting Lecturer Wanted') > careers.indexOf('Receptionist vacancy'), 'sort order: text flyer (5) comes after the others (0)');

    /* Admin list + dashboard */
    r = await admin.get('/admin/flyers');
    assert.match(r.text, /English Tutor – Colombo/);
    assert.match(r.text, /Receptionist vacancy/);
    assert.match(r.text, /Visiting Lecturer Wanted/);
    assert.match((await admin.get('/admin')).text, /Published job flyers/);
    r = await admin.get(`/admin/flyers/${img.id}`);
    assert.equal(r.status, 200);
    assert.match(r.text, /Current file/);

    /* Validation */
    const before = row('SELECT COUNT(*) AS n FROM flyers').n;
    const bad = async (fields, file, status, re, label) => {
      const x = await send('/admin/flyers/new', { status: 'draft', ...fields }, file);
      assert.equal(x.status, status, `${label}: ${x.text.slice(0, 200)}`);
      assert.match(x.text, re, label);
    };
    await bad({ kind: 'pdf', title: 'PNG pretending to be PDF' }, { data: png(2), type: 'application/pdf', name: 'x.pdf' }, 422, /not a PDF/, 'PNG as PDF');
    await bad({ kind: 'image', title: 'PDF pretending to be image', alt: 'x' }, { data: pdf(2), type: 'image/png', name: 'x.png' }, 422, /not a JPG, PNG or WebP/, 'PDF as image');
    await bad({ kind: 'image', title: 'Fake SVG', alt: 'x' }, { data: Buffer.from('<svg onload=alert(1)>'), type: 'image/png', name: 'evil.png' }, 422, /not a JPG, PNG or WebP/, 'fake image');
    await bad({ kind: 'pdf', title: 'Wrong extension' }, { data: pdf(3), type: 'application/pdf', name: 'x.txt' }, 422, /not a PDF/, 'PDF with wrong extension');
    await bad({ kind: 'image', title: 'No file', alt: 'x' }, null, 422, /Choose an image to upload/, 'image without file');
    await bad({ kind: 'pdf', title: 'No file either' }, null, 422, /Choose a PDF to upload/, 'pdf without file');
    await bad({ kind: 'image', title: 'No alt text' }, { data: png(3), type: 'image/png', name: 'a.png' }, 422, /alt text/i, 'image without alt');
    await bad({ kind: 'text', title: 'Empty words' }, null, 422, /Enter the flyer text/, 'text without body');
    await bad({ kind: 'banner', title: 'Odd type' }, null, 422, /Choose a valid option/, 'unknown type');
    await bad({ kind: 'text', title: '', body: 'x' }, null, 422, /Title is required/, 'missing title');
    await bad({ kind: 'text', title: 'Bad date', body: 'x', deadline: '2026-13-45' }, null, 422, /valid date/, 'bad date');
    await bad({ kind: 'image', title: 'Huge', alt: 'x' }, { data: Buffer.concat([tinyPng(), Buffer.alloc(9 * 1024 * 1024)]), type: 'image/png', name: 'huge.png' }, 413, /too large/, 'oversized file');

    /* Duplicates are refused: same title (any capitalisation) or the exact same file */
    await bad({ kind: 'text', title: 'visiting lecturer WANTED', body: 'again' }, null, 422, /already exists/, 'duplicate title');
    await bad({ kind: 'image', title: 'Same picture, new title', alt: 'x' }, { data: png(1), type: 'image/png', name: 'copy.png' }, 422, /already uploaded as “English Tutor – Colombo”/, 'duplicate file');
    assert.equal(row('SELECT COUNT(*) AS n FROM flyers').n, before, 'nothing was saved by the rejected submissions');
    assert.equal(filesOnDisk(), 2, 'rejected uploads leave no files behind');

    const noCsrf = new FormData(); noCsrf.append('kind', 'text'); noCsrf.append('title', 'No token'); noCsrf.append('body', 'x');
    assert.equal((await admin.req('POST', '/admin/flyers/new', { fd: noCsrf })).status, 403);
    assert.equal((await new Client().req('POST', '/admin/flyers/new', { fd: noCsrf })).status, 303, 'signed-out users are sent to log in');

    /* Edit: title only keeps the file; switching type needs the right file and cleans up the old one */
    r = await send(`/admin/flyers/${img.id}`, { kind: 'image', title: 'English Tutor (Colombo)', summary: 'Join our teaching team', alt: 'Flyer: English tutor wanted in Colombo', status: 'published' });
    assert.equal(r.status, 303, r.text.slice(0, 400));
    assert.equal(row('SELECT file FROM flyers WHERE id = ?', img.id).file, img.file, 'file kept when none is uploaded');
    r = await send(`/admin/flyers/${img.id}`, { kind: 'pdf', title: 'English Tutor (Colombo)', status: 'published' });
    assert.equal(r.status, 422);
    assert.match(r.text, /Choose a PDF to upload/);
    r = await send(`/admin/flyers/${img.id}`, { kind: 'pdf', title: 'English Tutor (Colombo)', status: 'published' }, { data: pdf(4), type: 'application/pdf', name: 'tutor.pdf' });
    assert.equal(r.status, 303, r.text.slice(0, 400));
    const nowPdf = row('SELECT * FROM flyers WHERE id = ?', img.id);
    assert.equal(nowPdf.kind, 'pdf');
    assert.notEqual(nowPdf.file, img.file);
    assert.ok(fs.existsSync(path.join(ROOT, 'public', 'uploads', nowPdf.file)));
    assert.ok(!fs.existsSync(path.join(ROOT, 'public', 'uploads', img.file)), 'old image deleted when replaced');
    assert.equal(nowPdf.alt, '', 'alt text only belongs to image flyers');
    r = await send(`/admin/flyers/${pdfRow.id}`, { kind: 'text', title: 'Receptionist vacancy', body: 'Now just words.', status: 'published' });
    assert.equal(r.status, 303);
    const nowText = row('SELECT * FROM flyers WHERE id = ?', pdfRow.id);
    assert.equal(nowText.file, ''); assert.equal(nowText.size, 0);
    assert.ok(!fs.existsSync(path.join(ROOT, 'public', 'uploads', pdfRow.file)), 'file deleted when a flyer becomes words-only');
    assert.equal(filesOnDisk(), 1);

    /* Closing date hides a flyer automatically; unpublish hides it; republish shows it */
    r = await send(`/admin/flyers/${txt.id}`, { kind: 'text', title: 'Visiting Lecturer Wanted', body: 'x', status: 'published', deadline: '2020-01-01' });
    assert.equal(r.status, 303);
    assert.equal(await publicHas(/Visiting Lecturer Wanted/), false, 'expired flyer is hidden');
    assert.match((await admin.get('/admin/flyers')).text, /Closing date passed/);
    r = await send(`/admin/flyers/${txt.id}`, { kind: 'text', title: 'Visiting Lecturer Wanted', body: 'x', status: 'published', deadline: '2099-01-01' });
    assert.equal(await publicHas(/Visiting Lecturer Wanted/), true, 'future closing date is shown');
    await admin.get(`/admin/flyers/${txt.id}`);
    r = await admin.post(`/admin/flyers/${txt.id}/status`, { status: 'draft' });
    assert.equal(r.status, 303);
    assert.equal(await publicHas(/Visiting Lecturer Wanted/), false, 'draft flyer is hidden');
    r = await admin.post(`/admin/flyers/${txt.id}/status`, { status: 'published' });
    assert.equal(await publicHas(/Visiting Lecturer Wanted/), true);
    assert.equal((await admin.post(`/admin/flyers/${txt.id}/status`, { status: 'archived' })).status, 400);

    /* Delete removes the row and its file */
    const pdfFile = path.join(ROOT, 'public', 'uploads', nowPdf.file);
    r = await admin.post(`/admin/flyers/${img.id}/delete`);
    assert.equal(r.location, '/admin/flyers?deleted=1');
    assert.equal(row('SELECT id FROM flyers WHERE id = ?', img.id), undefined);
    assert.ok(!fs.existsSync(pdfFile), 'file removed with the flyer');
    assert.equal((await pub.get(`/uploads/${nowPdf.file}`)).status, 404);
    assert.equal((await admin.get(`/admin/flyers/${img.id}`)).status, 404);
    for (const id of [pdfRow.id, txt.id]) await admin.post(`/admin/flyers/${id}/delete`);
    assert.equal(row('SELECT COUNT(*) AS n FROM flyers').n, 0);
    assert.equal(filesOnDisk(), 0);
    try { fs.rmSync(flyerDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  await t.test('duplicate titles are refused for programmes, vacancies and articles', async () => {
    for (const [key, base] of [['programmes', { availability: 'coming_soon' }], ['vacancies', { employment_type: 'Full-time' }], ['articles', {}]]) {
      let r = await admin.post(`/admin/${key}/new`, { title: 'Twin Title', status: 'draft', ...base });
      assert.equal(r.status, 303, `${key}: ${r.text.slice(0, 200)}`);
      r = await admin.post(`/admin/${key}/new`, { title: 'twin title', status: 'draft', ...base });
      assert.equal(r.status, 422, key);
      assert.match(r.text, /already has this title/, key);
      assert.equal(row(`SELECT COUNT(*) AS n FROM ${key} WHERE lower(title) = 'twin title'`).n, 1, key);
      const id = row(`SELECT id FROM ${key} WHERE title = 'Twin Title'`).id;
      r = await admin.post(`/admin/${key}/${id}`, { title: 'Twin Title', status: 'draft', ...base });
      assert.equal(r.status, 303, `${key}: editing an item may keep its own title`);
      await admin.post(`/admin/${key}/${id}/delete`);
    }
  });

  await t.test('settings: save, validation errors, unknown keys ignored', async () => {
    let r = await admin.post('/admin/settings/brand', { site_name: 'Rockford Academy', tagline: 'Hello <world>', logo_url: '', evil_key: 'x' });
    assert.equal(r.location, '/admin/settings/brand?saved=1');
    r = await admin.get('/admin/settings/brand?saved=1');
    assert.match(r.text, /Your changes have been saved/);
    assert.match(r.text, /Hello &lt;world&gt;/);
    assert.equal(row("SELECT value FROM settings WHERE key = 'tagline'").value, JSON.stringify('Hello <world>'));
    assert.equal(row("SELECT value FROM settings WHERE key = 'evil_key'"), undefined);

    r = await admin.post('/admin/settings/contact', { contact_email: 'not-an-email', contact_whatsapp: '0771234567', map_embed_url: 'https://evil.example/maps', social: 'Instagram https://x' });
    assert.equal(r.status, 422);
    assert.match(r.text, /valid email address/);
    assert.match(r.text, /country code/);
    assert.match(r.text, /maps\/embed/);
    assert.match(r.text, /Label \| https:\/\/link/);
    r = await admin.post('/admin/settings/contact', {
      contact_email: 'hello@rockford.test', contact_phone: '+94 11 234 5678', contact_whatsapp: '+94 77 123 4567',
      map_embed_url: 'https://www.google.com/maps/embed?pb=abc', social: 'Instagram | https://www.instagram.com/rockford\nFacebook | https://facebook.com/rockford',
    });
    assert.equal(r.status, 303);
    assert.equal(JSON.parse(row("SELECT value FROM settings WHERE key = 'contact_whatsapp'").value), '94771234567');
    assert.deepEqual(JSON.parse(row("SELECT value FROM settings WHERE key = 'social'").value), [{ label: 'Instagram', url: 'https://www.instagram.com/rockford' }, { label: 'Facebook', url: 'https://facebook.com/rockford' }]);

    r = await admin.post('/admin/settings/notifications', { notify_enquiries_to: 'a@rockford.test, bad', notify_applications_to: '' });
    assert.equal(r.status, 422);
    r = await admin.post('/admin/settings/notifications', { notify_enquiries_to: 'a@rockford.test; b@rockford.test', notify_applications_to: 'hr@rockford.test' });
    assert.equal(JSON.parse(row("SELECT value FROM settings WHERE key = 'notify_enquiries_to'").value), 'a@rockford.test, b@rockford.test');

    r = await admin.post('/admin/settings/analytics', { ga4_id: 'UA-123', gtm_id: 'GTM-ABC12', seo_default_description: 'x' });
    assert.equal(r.status, 422);
    assert.match(r.text, /G-ABC123XYZ/);
    r = await admin.post('/admin/settings/analytics', { ga4_id: 'g-abc123', gtm_id: '', search_console_verification: '<meta name="google-site-verification" content="abcDEF123_-xyz" />', seo_default_description: 'Desc', og_image_url: '' });
    assert.equal(r.status, 303);
    assert.equal(JSON.parse(row("SELECT value FROM settings WHERE key = 'ga4_id'").value), 'G-ABC123');
    assert.equal(JSON.parse(row("SELECT value FROM settings WHERE key = 'search_console_verification'").value), 'abcDEF123_-xyz');

    r = await admin.post('/admin/settings/recruitment', { retention_applications_days: '10', retention_enquiries_days: '365', programme_filter_threshold: '4' });
    assert.equal(r.status, 422);
    assert.match(r.text, /from 30 to 1825/);
    r = await admin.post('/admin/settings/recruitment', { eoi_enabled: '1', retention_applications_days: '180', retention_enquiries_days: '365', programme_filter_threshold: '4' });
    assert.equal(r.status, 303);
    assert.equal(row("SELECT value FROM settings WHERE key = 'eoi_enabled'").value, 'true');

    const home = Object.fromEntries(Object.keys(settingsDefaults).filter((k) => k.startsWith('home_')).map((k) => [k, settingsDefaults[k]]));
    r = await admin.post('/admin/settings/homepage', { ...home, home_hero_line1: 'Beyond <b>English</b>' });
    assert.equal(r.status, 303);

    const im = settingsDefaults.images; const img = {};
    for (const k of ['hero', 'journey1', 'journey2', 'journey3', 'programmes', 'about', 'approach', 'careers']) {
      img[`img_${k}_src`] = im[k].src; img[`img_${k}_alt`] = im[k].alt; if (k !== 'hero') img[`img_${k}_stock`] = '1';
    }
    im.gallery.forEach((g, i) => { img[`gal_${i}_label`] = g.label; img[`gal_${i}_src`] = g.src; img[`gal_${i}_alt`] = g.alt; img[`gal_${i}_stock`] = '1'; });
    r = await admin.post('/admin/settings/images', { ...img, img_hero_src: 'https://evil.example/x.jpg' });
    assert.equal(r.status, 422);
    assert.match(r.text, /Media Library/);
    r = await admin.post('/admin/settings/images', { ...img, img_hero_src: '/uploads/2026/11/hero.jpg' });
    assert.equal(r.status, 303);
    const saved = JSON.parse(row("SELECT value FROM settings WHERE key = 'images'").value);
    assert.deepEqual(saved.hero, { src: '/uploads/2026/11/hero.jpg', alt: im.hero.alt, stock: false });
    assert.equal(saved.gallery.length, 4);

    // Hero slideshow: image URLs are validated, empty slides are skipped, alt text is required.
    r = await admin.get('/admin/settings/slideshow');
    assert.equal(r.status, 200);
    assert.match(r.text, /Slide 5/);
    r = await admin.post('/admin/settings/slideshow', { sl_0_src: 'https://evil.example/x.jpg', sl_0_alt: 'x' });
    assert.equal(r.status, 422);
    r = await admin.post('/admin/settings/slideshow', { sl_0_src: '/uploads/2026/11/a.jpg', sl_0_alt: 'Students', sl_2_src: '/uploads/2026/11/b.jpg' });
    assert.equal(r.status, 422);
    assert.match(r.text, /Describe slide 3/);
    r = await admin.post('/admin/settings/slideshow', { sl_0_src: '/uploads/2026/11/a.jpg', sl_0_alt: 'Students', sl_2_src: '/uploads/2026/11/b.jpg', sl_2_alt: 'Workshop', sl_2_stock: '1' });
    assert.equal(r.status, 303);
    assert.deepEqual(JSON.parse(row("SELECT value FROM settings WHERE key = 'hero_slides'").value), [
      { src: '/uploads/2026/11/a.jpg', alt: 'Students', stock: false }, { src: '/uploads/2026/11/b.jpg', alt: 'Workshop', stock: true },
    ]);

    r = await admin.post('/admin/settings/legal', { legal_privacy: '## Privacy\nFinal.', legal_terms: '' });
    assert.equal(r.status, 422);
    r = await admin.post('/admin/settings/legal', { legal_privacy: '## Privacy\nFinal.', legal_terms: '## Terms\nFinal.' });
    assert.equal(r.status, 303);
    assert.equal((await admin.get('/admin/settings/nope')).status, 404);

    const dash = await admin.get('/admin');
    assert.doesNotMatch(dash.text, /Legal pages are still drafts/);
    assert.doesNotMatch(dash.text, /No contact details/);
    assert.match(dash.text, /11 temporary stock photos/);
  });

  let editorId; let recruiterId;
  await t.test('users: create, validation, roles enforced', async () => {
    let r = await admin.post('/admin/users', { name: 'Ed', email: 'editor@example.test', role: 'editor', password: 'short' });
    assert.equal(r.status, 422);
    assert.match(r.text, /at least 12 characters/);
    r = await admin.post('/admin/users', { name: 'Ed', email: 'editor@example.test', role: 'superuser', password: 'Editor pass 2026' });
    assert.equal(r.status, 422);
    r = await admin.post('/admin/users', { name: 'Ed Itor', email: 'Editor@Example.test', role: 'editor', password: 'Editor pass 2026' });
    assert.equal(r.status, 303);
    editorId = row("SELECT id FROM users WHERE email = 'editor@example.test'").id;
    r = await admin.post('/admin/users', { name: 'Dup', email: 'editor@example.test', role: 'editor', password: 'Editor pass 2026' });
    assert.equal(r.status, 422);
    assert.match(r.text, /already exists/);
    r = await admin.post('/admin/users', { name: 'Rec Ruiter', email: 'recruiter@example.test', role: 'recruiter', password: 'Recruit pass 2026' });
    assert.equal(r.status, 303);
    recruiterId = row("SELECT id FROM users WHERE email = 'recruiter@example.test'").id;

    const rec = new Client();
    assert.equal((await rec.login('recruiter@example.test', 'Recruit pass 2026')).status, 303);
    assert.equal((await rec.get('/admin/programmes')).status, 403);
    assert.equal((await rec.get('/admin/media')).status, 403);
    assert.equal((await rec.get('/admin/enquiries')).status, 403);
    assert.equal((await rec.get('/admin/settings/brand')).status, 403);
    assert.equal((await rec.get('/admin/users')).status, 403);
    assert.equal((await rec.get('/admin/applications')).status, 200);
    assert.equal((await rec.get('/admin/vacancies')).status, 200);
    assert.equal((await rec.get('/admin/flyers')).status, 200, 'recruiters manage job flyers');
    assert.equal((await rec.post('/admin/flyers/new', { kind: 'text', title: 'By recruiter', body: 'Words.', status: 'draft' })).status, 303);
    const recDash = await rec.get('/admin');
    assert.doesNotMatch(recDash.text, /Setup checklist/);
    assert.doesNotMatch(recDash.text, /href="\/admin\/programmes"/, 'nav hides programmes');
    assert.equal((await rec.post('/admin/programmes/new', { title: 'X' })).status, 403);

    const ed = new Client();
    assert.equal((await ed.login('editor@example.test', 'Editor pass 2026')).status, 303);
    assert.equal((await ed.get('/admin/applications')).status, 403);
    assert.equal((await ed.get('/admin/vacancies')).status, 403);
    assert.equal((await ed.get('/admin/flyers')).status, 403, 'editors cannot manage job flyers');
    assert.equal((await ed.post('/admin/flyers/new', { kind: 'text', title: 'By editor', body: 'x' })).status, 403);
    assert.equal((await ed.get('/admin/settings/brand')).status, 403);
    assert.equal((await ed.get('/admin/audit')).status, 403);
    assert.equal((await ed.get('/admin/programmes')).status, 200);
    assert.equal((await ed.get('/admin/enquiries')).status, 200);
    assert.equal((await ed.get('/admin/settings/homepage')).status, 200);
    assert.equal((await ed.get('/admin/settings')).location, '/admin/settings/homepage');

    r = await admin.post(`/admin/users/${editorId}/role`, { role: 'recruiter' });
    assert.equal(r.status, 303);
    assert.equal((await ed.get('/admin/applications')).status, 200, 'role change applies immediately');
    r = await admin.post(`/admin/users/${editorId}/password`, { password: 'weak' });
    assert.equal(r.status, 422);
    r = await admin.post(`/admin/users/${editorId}/password`, { password: 'Brand new pass 99' });
    assert.equal(r.status, 303);
    assert.equal((await ed.get('/admin')).status, 303, 'reset signs the user out');
    assert.equal((await new Client().login('editor@example.test', 'Brand new pass 99')).status, 303);

    const adminId = row('SELECT id FROM users WHERE email = ?', ADMIN.email).id;
    r = await admin.post(`/admin/users/${adminId}/delete`);
    assert.equal(r.status, 422);
    assert.match(r.text, /cannot delete your own account/);
    r = await admin.post(`/admin/users/${adminId}/role`, { role: 'editor' });
    assert.equal(r.status, 422);
    assert.match(r.text, /only administrator/);
    r = await admin.post(`/admin/users/${editorId}/delete`);
    assert.equal(r.location, '/admin/users?deleted=1');
    assert.equal(row('SELECT id FROM users WHERE id = ?', editorId), undefined);
  });

  await t.test('lockout after 5 failed logins', async () => {
    await admin.post('/admin/users', { name: 'Locky', email: 'locky@example.test', role: 'editor', password: 'Locky pass 2026' });
    const c = new Client();
    for (let i = 0; i < 5; i++) assert.equal((await c.login('locky@example.test', 'wrong pass 0000')).status, 401);
    const u = row("SELECT locked_until FROM users WHERE email = 'locky@example.test'");
    assert.ok(u.locked_until > Date.now() + 14 * 60000);
    // Both the per-IP+email throttle (429) and the account lock refuse the correct password, with the same generic message.
    const r = await c.login('locky@example.test', 'Locky pass 2026');
    assert.ok([401, 429].includes(r.status), 'correct password refused while locked');
    assert.match(r.text, /Email or password is incorrect/);
    assert.equal(row("SELECT last_login_at FROM users WHERE email = 'locky@example.test'").last_login_at, null);
  });

  await t.test('two-factor: enable, sign in with TOTP, disable', async () => {
    let r = await admin.get('/admin/account/2fa');
    const secret = /name="secret" value="([A-Z2-7]{32})"/.exec(r.text)[1];
    assert.match(r.text, /otpauth:\/\/totp\//);
    r = await admin.post('/admin/account/2fa', { secret, code: '000000' === security.totpAt(secret, Math.floor(Date.now() / 30000)) ? '111111' : '000000' });
    assert.equal(r.status, 422);
    r = await admin.post('/admin/account/2fa', { secret, code: security.totpAt(secret, Math.floor(Date.now() / 30000)) });
    assert.equal(r.location, '/admin/account?twofa_on=1');
    assert.equal(row('SELECT totp_secret FROM users WHERE email = ?', ADMIN.email).totp_secret, secret);

    const c = new Client();
    r = await c.login(ADMIN.email, ADMIN.password, '/admin/users');
    assert.equal(r.location, '/admin/2fa?next=%2Fadmin%2Fusers');
    assert.equal((await c.get('/admin')).location, '/admin/2fa', 'pending 2FA cannot reach admin pages');
    r = await c.get('/admin/2fa?next=%2Fadmin%2Fusers');
    assert.equal(r.status, 200);
    r = await c.post('/admin/2fa', { code: '12345', next: '/admin/users' });
    assert.equal(r.status, 401);
    r = await c.post('/admin/2fa', { code: security.totpAt(secret, Math.floor(Date.now() / 30000)), next: '/admin/users' });
    assert.equal(r.location, '/admin/users');
    assert.equal((await c.get('/admin/users')).status, 200);

    r = await admin.post('/admin/account/2fa/disable', { disable_password: 'nope' });
    assert.equal(r.status, 422);
    r = await admin.post('/admin/account/2fa/disable', { disable_password: ADMIN.password });
    assert.equal(r.location, '/admin/account?twofa_off=1');
    assert.equal(row('SELECT totp_secret FROM users WHERE email = ?', ADMIN.email).totp_secret, null);

    // Admin can remove another user's 2FA
    db.q.run('UPDATE users SET totp_secret = ? WHERE id = ?', security.newTotpSecret(), recruiterId);
    r = await admin.post(`/admin/users/${recruiterId}/2fa/remove`);
    assert.equal(r.status, 303);
    assert.equal(row('SELECT totp_secret FROM users WHERE id = ?', recruiterId).totp_secret, null);
  });

  await t.test('applications: list, search, filters, detail, status, CV download, delete', async () => {
    const pdf = tinyPdf();
    const ins = (ref, name, extra = {}) => {
      const file = crypto.randomUUID() + '.pdf';
      fs.writeFileSync(path.join(DATA_DIR, 'cvs', file), pdf);
      const a = { ref, vacancy_id: vacancyId, position: 'English Trainer', name, email: `${ref.toLowerCase()}@example.test`, phone: '+94 77 000 0000',
        qualifications: 'BA English\nCELTA', experience: '3 years', message: 'Hello <script>alert(1)</script>\nSecond line', cv_file: file,
        cv_name: 'My "CV"\r\n.pdf', cv_mime: 'application/pdf', cv_size: pdf.length, created_at: Date.now(), retention_until: Date.now() + 86400000 * 180, ...extra };
      const cols = Object.keys(a);
      const id = Number(db.q.run(`INSERT INTO applications (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...cols.map((k) => a[k])).lastInsertRowid);
      return { id, file };
    };
    const a1 = ins('RA-2026-AAAAAA', 'Nimal Perera');
    const a2 = ins('RA-2026-BBBBBB', 'Kumari Silva', { vacancy_id: null, position: 'General interest', status: 'reviewing', created_at: Date.now() - 1000 });
    for (let i = 0; i < 26; i++) db.q.run("INSERT INTO applications (ref, position, name, email, phone, qualifications, experience, cv_file, cv_name, cv_mime, cv_size, created_at, retention_until) VALUES (?, 'Filler', ?, 'f@example.test', '1', 'q', 'e', 'missing.pdf', 'x.pdf', 'application/pdf', 1, ?, ?)", `RA-2026-F${String(i).padStart(5, '0')}`, `Filler ${i}`, Date.now() - 100000 - i, Date.now() + 86400000);

    let r = await admin.get('/admin/applications');
    assert.equal(r.status, 200);
    assert.match(r.text, /28 results/);
    assert.match(r.text, /RA-2026-AAAAAA/);
    r = await admin.get('/admin/applications?page=2');
    assert.match(r.text, /aria-current="page">2</);
    r = await admin.post('/admin/applications', { q: 'kumari' });
    assert.equal(r.status, 200);
    assert.match(r.text, /RA-2026-BBBBBB/);
    assert.doesNotMatch(r.text, /RA-2026-AAAAAA/);
    r = await admin.post('/admin/applications', { q: '100%' });
    assert.match(r.text, /0 results/, 'LIKE wildcards are escaped');
    r = await admin.post('/admin/applications', { q: '', vacancy: String(vacancyId), status: '' });
    assert.equal(r.location, `/admin/applications?vacancy=${vacancyId}`);
    r = await admin.get(`/admin/applications?vacancy=${vacancyId}`);
    assert.match(r.text, /1 result</);
    r = await admin.get('/admin/applications?status=reviewing');
    assert.match(r.text, /RA-2026-BBBBBB/);
    assert.doesNotMatch(r.text, /RA-2026-AAAAAA/);

    r = await admin.get(`/admin/applications/${a1.id}`);
    assert.equal(r.status, 200);
    assert.match(r.text, /Hello &lt;script&gt;alert\(1\)&lt;\/script&gt;<br>Second line/);
    assert.doesNotMatch(r.text, /<script>alert/);
    assert.match(r.text, /will be deleted automatically on/);

    r = await admin.post(`/admin/applications/${a1.id}`, { status: 'superstar', notes: '' });
    assert.equal(r.status, 422);
    r = await admin.post(`/admin/applications/${a1.id}`, { status: 'shortlisted', notes: 'Strong <candidate>' });
    assert.equal(r.status, 303);
    assert.deepEqual({ ...row('SELECT status, notes FROM applications WHERE id = ?', a1.id) }, { status: 'shortlisted', notes: 'Strong <candidate>' });

    r = await admin.get(`/admin/applications/${a1.id}/cv`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.match(r.headers.get('content-disposition'), /^attachment; filename="[A-Za-z0-9 ._()-]+\.pdf"$/);
    assert.ok(r.buf.equals(pdf));
    assert.ok(row("SELECT id FROM audit_log WHERE action = 'application.cv_download' AND detail = 'RA-2026-AAAAAA'"));
    const filler = row("SELECT id FROM applications WHERE ref = 'RA-2026-F00000'").id;
    assert.equal((await admin.get(`/admin/applications/${filler}/cv`)).status, 404);
    assert.equal((await new Client().get(`/admin/applications/${a1.id}/cv`)).status, 303, 'CV needs sign-in');

    r = await admin.post(`/admin/applications/${a1.id}/delete`);
    assert.equal(r.location, '/admin/applications?deleted=1');
    assert.equal(row('SELECT id FROM applications WHERE id = ?', a1.id), undefined);
    assert.ok(!fs.existsSync(path.join(DATA_DIR, 'cvs', a1.file)));
    assert.ok(fs.existsSync(path.join(DATA_DIR, 'cvs', a2.file)));
  });

  await t.test('enquiries: list, filter, search, detail, status, delete', async () => {
    const pid = Number(db.q.run("INSERT INTO programmes (slug, title, created_at, updated_at) VALUES ('ielts', 'IELTS Prep', ?, ?)", Date.now(), Date.now()).lastInsertRowid);
    const ins = (ref, type, name, programmeId = null) => Number(db.q.run('INSERT INTO enquiries (ref, type, programme_id, name, email, message, created_at, retention_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ref, type, programmeId, name, 'e@example.test', 'Please call me\nThanks', Date.now(), Date.now() + 86400000).lastInsertRowid);
    const e1 = ins('EN-2026-AAAAAA', 'programme', 'Saman', pid);
    ins('EN-2026-BBBBBB', 'general', 'Dilini');
    let r = await admin.get('/admin/enquiries');
    assert.match(r.text, /2 results/);
    assert.match(r.text, /IELTS Prep/);
    r = await admin.get('/admin/enquiries?type=general');
    assert.match(r.text, /EN-2026-BBBBBB/);
    assert.doesNotMatch(r.text, /EN-2026-AAAAAA/);
    r = await admin.post('/admin/enquiries', { q: 'saman' });
    assert.match(r.text, /EN-2026-AAAAAA/);
    assert.doesNotMatch(r.text, /EN-2026-BBBBBB/);
    r = await admin.get(`/admin/enquiries/${e1}`);
    assert.match(r.text, /IELTS Prep/);
    assert.match(r.text, /Please call me<br>Thanks/);
    r = await admin.post(`/admin/enquiries/${e1}`, { status: 'in_progress' });
    assert.equal(r.status, 303);
    assert.equal(row('SELECT status FROM enquiries WHERE id = ?', e1).status, 'in_progress');
    r = await admin.post(`/admin/enquiries/${e1}/delete`);
    assert.equal(r.status, 303);
    assert.equal(row('SELECT id FROM enquiries WHERE id = ?', e1), undefined);
  });

  await t.test('account: change password', async () => {
    let r = await admin.post('/admin/account/password', { current_password: 'wrong', new_password: 'Another pass 2027', confirm_password: 'Another pass 2027' });
    assert.equal(r.status, 422);
    assert.match(r.text, /current password is not correct/);
    r = await admin.post('/admin/account/password', { current_password: ADMIN.password, new_password: 'Another pass 2027', confirm_password: 'Different 2027xx' });
    assert.equal(r.status, 422);
    r = await admin.post('/admin/account/password', { current_password: ADMIN.password, new_password: 'Another pass 2027', confirm_password: 'Another pass 2027' });
    assert.equal(r.location, '/admin/account?password=1');
    assert.equal((await admin.get('/admin')).status, 200, 'current session kept');
    assert.equal((await new Client().login(ADMIN.email, 'Another pass 2027')).status, 303);
  });

  await t.test('audit log lists actions', async () => {
    const r = await admin.get('/admin/audit');
    assert.equal(r.status, 200);
    for (const a of ['programmes.create', 'application.cv_download', 'user.create', 'settings.update', 'account.2fa_on', 'login.locked']) assert.match(r.text, new RegExp(a.replace('.', '\\.')));
  });

  await t.test('logout', async () => {
    assert.equal((await admin.post('/admin/logout', {}, { csrf: false })).status, 403);
    const r = await admin.post('/admin/logout');
    assert.equal(r.location, '/admin/login?loggedout=1');
    assert.equal((await admin.get('/admin')).status, 303);
  });
});
