'use strict';
/*
 * End-to-end tests for the public site and forms. Spawns the real server on a free port with a
 * throwaway data directory, seeds content directly in SQLite, then exercises pages and forms.
 * Run: npm test
 */
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

const ROOT = path.resolve(__dirname, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-public-'));
let BASE; let proc; let q;

const freePort = () => new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const token = (html) => (/name="_t" value="([^"]+)"/.exec(html) || [])[1];
const post = (p, fields) => fetch(BASE + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields) });
function apply(slug, fields, file) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (file) fd.append('cv', new Blob([file.data], { type: file.type }), file.name);
  return fetch(`${BASE}/careers/${slug}/apply`, { method: 'POST', body: fd, redirect: 'manual' });
}

test.before(async () => {
  const port = await freePort();
  BASE = `http://127.0.0.1:${port}`;
  proc = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATA_DIR: DATA, PORT: String(port), MAIL_TRANSPORT: 'outbox', NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 10000);
    proc.stdout.on('data', (d) => { if (String(d).includes('running at')) { clearTimeout(t); resolve(); } });
    proc.on('exit', (c) => reject(new Error('server exited ' + c)));
  });
  process.env.DATA_DIR = DATA;
  q = require('../src/db').q;
  const t = Date.now();
  q.run(`INSERT INTO programmes (slug,title,excerpt,body,audience,duration,format,category,objectives,availability,status,created_at,updated_at)
    VALUES ('comm','Communication Foundations','Excerpt','## Overview\nBody **bold**','School leavers','12 weeks','In person','Communication','["Speak with confidence"]','enrolling','published',?,?)`, t, t);
  q.run("INSERT INTO programmes (slug,title,status,created_at,updated_at) VALUES ('draft-prog','Draft Programme','draft',?,?)", t, t);
  q.run(`INSERT INTO vacancies (slug,title,summary,description,responsibilities,qualifications,employment_type,location,deadline,status,published_at,created_at,updated_at)
    VALUES ('trainer','Trainer','Summary','Desc <script>alert(1)</script>','["Teach"]','["Degree"]','Full-time','Colombo','2099-12-31','open',?,?,?)`, t, t, t);
  q.run("INSERT INTO vacancies (slug,title,status,deadline,created_at,updated_at) VALUES ('expired','Expired Role','open','2020-01-01',?,?)", t, t);
  q.run("INSERT INTO articles (slug,title,body,status,published_at,created_at,updated_at) VALUES ('post','A Post','[x](javascript:alert(1)) [ok](https://example.com)','published',?,?,?)", t - 1000, t, t);
  q.run("INSERT INTO testimonials (name,quote,status,consent_confirmed,approved_by,created_at,updated_at) VALUES ('No Consent','Should not show','published',0,'',?,?)", t, t);
});

test.after(() => { if (proc) proc.kill(); try { fs.rmSync(DATA, { recursive: true, force: true }); } catch { /* windows file locks */ } });

test('all public pages respond', async () => {
  for (const p of ['/', '/about', '/our-approach', '/programmes', '/programmes/comm', '/careers', '/careers/trainer', '/careers/expired', '/contact', '/news', '/news/post', '/privacy-policy', '/terms', '/robots.txt', '/sitemap.xml', '/favicon.svg', '/assets/css/main.css', '/assets/js/main.js']) {
    const r = await fetch(BASE + p);
    assert.strictEqual(r.status, 200, p);
  }
  for (const p of ['/nope', '/programmes/draft-prog', '/news/missing', '/careers/missing']) assert.strictEqual((await fetch(BASE + p)).status, 404, p);
});

test('content rules: drafts, expiry, consent, escaping, structured data', async () => {
  const home = await (await fetch(BASE + '/')).text();
  assert.ok(home.includes('Communication Foundations') && !home.includes('Draft Programme'));
  assert.ok(home.includes('Trainer') && !home.includes('Expired Role'));
  assert.ok(!home.includes('Should not show'), 'testimonial without consent must stay hidden');
  const vac = await (await fetch(BASE + '/careers/trainer')).text();
  assert.ok(!vac.includes('<script>alert(1)') && vac.includes('"JobPosting"'));
  const exp = await (await fetch(BASE + '/careers/expired')).text();
  assert.ok(exp.includes('Applications closed') && !exp.includes('/careers/expired/apply'));
  const post = await (await fetch(BASE + '/news/post')).text();
  assert.ok(!post.includes('javascript:') && post.includes('href="https://example.com"'));
  const sm = await (await fetch(BASE + '/sitemap.xml')).text();
  assert.ok(sm.includes('/programmes/comm') && !sm.includes('draft-prog') && !sm.includes('/careers/expired'));
});

test('security headers and static file safety', async () => {
  const r = await fetch(BASE + '/');
  assert.match(r.headers.get('content-security-policy'), /script-src 'self' 'nonce-/);
  assert.strictEqual(r.headers.get('x-frame-options'), 'DENY');
  assert.strictEqual((await fetch(BASE + '/assets/../src/config.js')).status, 404);
  assert.strictEqual((await fetch(BASE + '/assets/%2e%2e/server.js')).status, 404);
});

test('enquiry form: validation, anti-spam and storage', async () => {
  let tk = token(await (await fetch(BASE + '/contact')).text());
  let r = await post('/enquire', { _t: tk, from: 'contact', name: 'Fast', email: 'f@example.com', message: 'Too fast submission', consent: '1' });
  assert.strictEqual(r.status, 400, 'time trap');
  await sleep(2700);
  r = await post('/enquire', { _t: tk, from: 'contact', name: 'A', email: 'bad', message: 'x' });
  assert.strictEqual(r.status, 422);
  r = await post('/enquire', { _t: tk, website: 'http://spam', name: 'Bot', email: 'b@example.com', message: 'spam spam spam', consent: '1' });
  assert.strictEqual(r.status, 303);
  assert.strictEqual(q.get('SELECT COUNT(*) c FROM enquiries').c, 0, 'honeypot must not store');
  r = await post('/enquire', { _t: tk, from: 'contact', topic: 'general', name: 'Real Person', email: 'Real@Example.com', message: 'Hello, I have a question.', consent: '1' });
  assert.strictEqual(r.status, 303);
  assert.match(r.headers.get('location'), /^\/thank-you\?form=enquiry&ref=RA-ENQ-\d{4}-[A-Z0-9]{6}$/);
  const row = q.get('SELECT * FROM enquiries');
  assert.strictEqual(row.email, 'real@example.com');
  assert.ok(row.retention_until > Date.now());
});

test('job application: CV validation, private storage, references', async () => {
  const tk = token(await (await fetch(BASE + '/careers/trainer')).text());
  await sleep(2700);
  const base = { _t: tk, name: 'App Licant', email: 'app@example.com', phone: '0771234567', qualifications: 'BA', experience: '2 years', consent: '1' };
  let r = await apply('trainer', base, { data: Buffer.from('MZ not a pdf'), type: 'application/pdf', name: 'cv.pdf' });
  assert.strictEqual(r.status, 422);
  r = await apply('trainer', base, { data: Buffer.from('PK\u0003\u0004 not a real docx'), type: 'application/msword', name: 'cv.docx' });
  assert.strictEqual(r.status, 422);
  r = await apply('trainer', base, { data: Buffer.from('%PDF-1.4\n%%EOF'), type: 'application/pdf', name: 'My CV.pdf' });
  assert.strictEqual(r.status, 303, r.status === 303 ? '' : ((/class="form-alert"[\s\S]*?<\/div>/.exec(await r.text()) || [''])[0].replace(/<[^>]+>/g, ' ')));
  assert.match(r.headers.get('location'), /form=application&ref=RA-APP-/);
  const a = q.get('SELECT * FROM applications');
  assert.ok(fs.existsSync(path.join(DATA, 'cvs', a.cv_file)));
  assert.strictEqual((await fetch(BASE + '/uploads/' + a.cv_file)).status, 404, 'CV must not be public');
  assert.strictEqual((await fetch(BASE + '/admin/applications/' + a.id + '/cv', { redirect: 'manual' })).status, 303, 'CV download requires login');
  r = await fetch(BASE + '/careers/expired/apply', { method: 'POST', body: new FormData(), redirect: 'manual' });
  assert.strictEqual(r.status, 303);
  assert.strictEqual(q.get('SELECT COUNT(*) c FROM applications').c, 1);
});

test('no personal data in URLs or analytics hooks', async () => {
  const html = await (await fetch(BASE + '/thank-you?form=application&ref=RA-APP-2026-ABCDEF')).text();
  assert.ok(html.includes('data-analytics-event="job_application_submitted"'));
  assert.ok(!/app@example\.com/.test(html));
});
