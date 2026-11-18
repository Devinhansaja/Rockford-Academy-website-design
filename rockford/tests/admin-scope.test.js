'use strict';
/*
 * Default admin scope ("jobs"): the admin can only add, publish and remove vacancies and job flyers.
 * Every other admin section is hidden and blocked. Runs its own server with ADMIN_SCOPE unset.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rockford-scope-test-'));
const ADMIN = { name: 'Jobs Admin', email: 'jobs-admin@example.test', password: 'correct horse 123' };
let server; let base;

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  s.on('error', reject);
});

class Client {
  constructor() { this.cookie = ''; this.csrf = ''; }
  async req(method, p, form) {
    const headers = {};
    if (this.cookie) headers.cookie = this.cookie;
    let body;
    if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
    const r = await fetch(base + p, { method, headers, body, redirect: 'manual' });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); if (kv.startsWith('rf_session=')) this.cookie = kv; }
    const text = await r.text();
    const m = /name="_csrf" value="([^"]+)"/.exec(text);
    if (m) this.csrf = m[1];
    return { status: r.status, location: r.headers.get('location'), text };
  }
  get(p) { return this.req('GET', p); }
  post(p, form = {}) { return this.req('POST', p, { _csrf: this.csrf, ...form }); }
}

before(async () => {
  const env = { ...process.env, DATA_DIR, NODE_ENV: 'development', HOST: '127.0.0.1', MAIL_TRANSPORT: 'outbox', SITE_URL: '' };
  delete env.ADMIN_SCOPE;
  const made = spawnSync(process.execPath, ['scripts/create-admin.js', '--name', ADMIN.name, '--email', ADMIN.email, '--password', ADMIN.password], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
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
});

after(async () => {
  if (server && server.exitCode === null) { const exited = new Promise((r) => server.once('exit', r)); server.kill(); await exited; }
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

test('admin scope "jobs": only vacancies and job flyers', async (t) => {
  const admin = new Client();
  const page = await admin.get('/admin/login');
  const token = /name="_token" value="([^"]+)"/.exec(page.text)[1];
  const login = await admin.req('POST', '/admin/login', { _token: token, email: ADMIN.email, password: ADMIN.password, next: '' });
  assert.equal(login.status, 303);

  await t.test('menu shows only Vacancies, Job Flyers and My account', async () => {
    const r = await admin.get('/admin');
    assert.equal(r.status, 200);
    const links = [...r.text.matchAll(/<li><a href="(\/admin[^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(links, ['/admin', '/admin/vacancies', '/admin/flyers', '/admin/account']);
    assert.match(r.text, /Open vacancies/);
    assert.match(r.text, /Published job flyers/);
    assert.doesNotMatch(r.text, /Setup checklist|New applications|New enquiries|Published programmes/);
  });

  await t.test('every other section is blocked', async () => {
    for (const p of ['/admin/pages', '/admin/programmes', '/admin/programmes/new', '/admin/applications', '/admin/enquiries', '/admin/articles', '/admin/testimonials', '/admin/media', '/admin/settings/brand', '/admin/users', '/admin/audit']) {
      assert.equal((await admin.get(p)).status, 403, `${p} must be blocked`);
    }
    assert.equal((await admin.post('/admin/programmes/new', { title: 'Sneaky', status: 'draft' })).status, 403);
    assert.equal((await admin.get('/admin/settings')).status, 403);
  });

  await t.test('vacancies: add, publish and remove', async () => {
    assert.equal((await admin.get('/admin/vacancies')).status, 200);
    let r = await admin.post('/admin/vacancies/new', { title: 'Receptionist', employment_type: 'Full-time', status: 'open', summary: 'Front desk', description: 'Welcome visitors.' });
    assert.equal(r.status, 303, r.text.slice(0, 300));
    const id = /\/admin\/vacancies\/(\d+)/.exec(r.location)[1];
    const careers = await fetch(`${base}/careers`).then((x) => x.text());
    assert.match(careers, /Receptionist/);
    r = await admin.get(`/admin/vacancies/${id}`);
    assert.doesNotMatch(r.text, /\/admin\/applications/, 'no link to the blocked applications section');
    r = await admin.post(`/admin/vacancies/${id}/delete`);
    assert.equal(r.location, '/admin/vacancies?deleted=1');
    assert.doesNotMatch(await fetch(`${base}/careers`).then((x) => x.text()), /Receptionist/);
  });

  await t.test('job flyers: add and remove', async () => {
    let r = await admin.post('/admin/flyers/new', { kind: 'text', title: 'Tutor wanted', body: 'Send your CV.', status: 'published' });
    assert.equal(r.status, 303, r.text.slice(0, 300));
    const id = /\/admin\/flyers\/(\d+)/.exec(r.location)[1];
    assert.match(await fetch(`${base}/careers`).then((x) => x.text()), /Tutor wanted/);
    r = await admin.post(`/admin/flyers/${id}/delete`);
    assert.equal(r.location, '/admin/flyers?deleted=1');
    assert.doesNotMatch(await fetch(`${base}/careers`).then((x) => x.text()), /Tutor wanted/);
  });
});
