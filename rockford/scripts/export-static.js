'use strict';
/*
 * Static preview export (used by Vercel).
 *
 * Vercel cannot run this site as-is: it needs a long-running server and a writable disk for the
 * SQLite database, sessions and CV uploads. This script renders every public page with the real
 * templates into ./dist as plain HTML so the DESIGN can be previewed on any static host.
 * The forms do not work in this preview. The admin panel is exported too, as a clickable DEMO: pages are
 * rendered from a throwaway database with sample vacancies and flyers, and nothing can be saved.
 * Deploy the Node server for the live site (see docs/DEPLOY.md).
 *
 *   node scripts/export-static.js        → writes rockford/dist
 */
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w); });

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rockford-export-'));
process.env.NODE_ENV = 'development';
process.env.MAIL_TRANSPORT = 'outbox';

const app = require('../src/app');
require('../src/routes/public').register(app);
require('../src/routes/forms').register(app);
require('../src/routes/seo').register(app);
require('../src/routes/admin').register(app);

const PREVIEW_SCRIPT = `<script>
document.addEventListener('submit', function (e) {
  var f = e.target; if (!f.matches('form[data-static-preview]')) return;
  e.preventDefault(); e.stopImmediatePropagation();
  var n = f.querySelector('.static-preview-note');
  if (!n) { n = document.createElement('p'); n.className = 'static-preview-note'; n.setAttribute('role', 'status');
    n.style.cssText = 'margin-top:16px;padding:12px 16px;border-radius:12px;background:#F8EBD0;color:#14243B;font-size:14px';
    f.appendChild(n); }
  n.textContent = 'This is a design preview. The form will start working when the site runs on its live server.';
}, true);
</script>`;

const DEMO = { email: 'demo@rockford.test', password: 'demo-password-2026' };

const ADMIN_DEMO = `<div id="demo-bar" role="status" style="position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9999;max-width:92vw;padding:10px 18px;border-radius:999px;background:#142747;color:#fff;font:600 13px/1.4 Inter,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3);text-align:center"><span id="demo-msg">Demo admin: what you add or delete here shows on the website (this browser only).</span> <a href="#" data-demo-reset style="color:#C99A43;margin-left:8px">Reset demo</a></div>
<script>
(function () {
  document.addEventListener('submit', function (e) {
    var a = e.target.getAttribute('action') || '';
    if (a === '/admin/login') { e.preventDefault(); e.stopImmediatePropagation(); location.href = '/admin'; }
    else if (a === '/admin/logout') { e.preventDefault(); e.stopImmediatePropagation(); location.href = '/admin/login'; }
  }, true);
  document.addEventListener('DOMContentLoaded', function () {
    var f = document.querySelector('form[action="/admin/login"]');
    if (!f) return;
    var em = f.querySelector('input[name=email]'), pw = f.querySelector('input[name=password]');
    if (em) em.value = '__EMAIL__'; if (pw) pw.value = '__PASSWORD__';
    var n = document.createElement('p'); n.style.cssText = 'margin:0 0 14px;padding:10px 14px;border-radius:10px;background:#F5F1E7;color:#142747;font-size:14px';
    n.textContent = 'Demo login is filled in. Just click Sign in.'; f.insertBefore(n, f.firstChild);
  });
})();
</script>`.replace('__EMAIL__', DEMO.email).replace('__PASSWORD__', DEMO.password);

const DEMO_TAG = '<script src="/assets/js/demo.js" defer></script>';

/** Sample data handed to the browser demo script (what the demo admin starts with). */
function buildSeed() {
  const { q } = require('../src/db');
  const arr = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };
  return {
    vacancies: q.all('SELECT * FROM vacancies ORDER BY id').map((v) => ({
      id: v.id, slug: v.slug, title: v.title, summary: v.summary, description: v.description, responsibilities: arr(v.responsibilities), qualifications: arr(v.qualifications),
      employment_type: v.employment_type, location: v.location, category: v.category, deadline: v.deadline, status: v.status, created: v.created_at,
    })),
    flyers: q.all('SELECT * FROM flyers ORDER BY id').map((f) => ({
      id: f.id, kind: f.kind, title: f.title, summary: f.summary, body: f.body, fileUrl: f.file ? `/uploads/${f.file}` : '', fileName: f.original_name, size: f.size, mime: f.mime,
      sha: f.sha256, alt: f.alt, deadline: f.deadline, status: f.status, sort: f.sort, created: f.created_at,
    })),
  };
}
/** Fill the throwaway database with a demo admin plus sample vacancies and flyers (never real data). */
function seedDemo() {
  const crypto = require('node:crypto');
  const { q, now } = require('../src/db');
  const security = require('../src/security');
  q.run('INSERT INTO users (email, name, role, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)', DEMO.email, 'Demo Admin', 'admin', security.hashPassword(DEMO.password), now());
  const t = now(); const day = 86400000;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const vac = (slug, title, summary, type, location, category, status, deadline) => q.run(
    `INSERT INTO vacancies (slug, title, summary, description, responsibilities, qualifications, employment_type, location, category, deadline, status, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    slug, title, summary, `${summary}\n\nThis is a sample vacancy used in the design preview.`,
    JSON.stringify(['Plan and deliver engaging sessions', 'Support learners with feedback and encouragement']),
    JSON.stringify(['Relevant degree or equivalent experience', 'Excellent spoken and written English']),
    type, location, category, deadline, status, t, t, t);
  vac('english-tutor-sample', 'English Tutor (sample)', 'Teach spoken English and communication skills to young adults.', 'Full-time', 'Colombo', 'Teaching', 'open', iso(t + 45 * day));
  vac('front-desk-executive-sample', 'Front Desk Executive (sample)', 'Welcome students and visitors and manage enquiries.', 'Part-time', 'Colombo', 'Operations', 'open', iso(t + 30 * day));
  vac('programme-coordinator-sample', 'Programme Coordinator (sample)', 'Coordinate schedules, venues and learner support.', 'Full-time', 'Colombo', 'Operations', 'draft', '');

  const d = new Date(); const sub = `flyers/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const assets = path.join(__dirname, 'demo-assets');
  const files = [];
  const flyer = (kind, title, summary, body, alt, file, deadline, sort) => {
    let f = { file: '', mime: '', size: 0, sha: '', name: '' };
    if (file) {
      const data = fs.readFileSync(path.join(assets, file.src));
      const rel = `${sub}/${crypto.randomUUID()}${path.extname(file.src)}`;
      files.push({ rel, data });
      f = { file: rel, mime: file.mime, size: data.length, sha: crypto.createHash('sha256').update(data).digest('hex'), name: file.src };
    }
    q.run(`INSERT INTO flyers (title, kind, summary, body, file, original_name, mime, size, sha256, alt, deadline, status, sort, published_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)`, title, kind, summary, body, f.file, f.name, f.mime, f.size, f.sha, alt, deadline, sort, t, t, t);
  };
  flyer('image', 'English Tutor Flyer (sample)', 'Image flyer: a finished poster uploaded as a picture.', '', 'Sample flyer: English Tutor wanted in Colombo, full-time', { src: 'sample-flyer.png', mime: 'image/png' }, iso(t + 45 * day), 0);
  flyer('pdf', 'Front Desk Executive Flyer (sample)', 'PDF flyer: open it or download it.', '', '', { src: 'sample-flyer.pdf', mime: 'application/pdf' }, '', 1);
  flyer('text', 'Visiting Lecturer Notice (sample)', 'Words-only flyer: typed in the admin, laid out by the site.', '## What you will do\n\n- Teach spoken English and presentation skills\n- Run interactive workshops\n\n**How to apply:** email your CV to the careers team.', '', null, '', 2);
  return files;
}

/** Render the admin as a clickable demo: log in to the throwaway database and save each page. */
async function exportAdmin(base) {
  let r = await fetch(`${base}/admin/login`);
  const loginHtml = await r.text();
  const token = /name="_token" value="([^"]+)"/.exec(loginHtml)[1];
  r = await fetch(`${base}/admin/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ _token: token, email: DEMO.email, password: DEMO.password, next: '' }) });
  const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('rf_session='));
  if (!cookie) throw new Error('Demo admin login failed while exporting the admin demo.');

  const paths = ['/admin', '/admin/vacancies', '/admin/vacancies/new', '/admin/flyers', '/admin/flyers/new', '/admin/account'];
  const have = new Set(['/admin/login', ...paths]);

  const pages = [['/admin/login', loginHtml]];
  for (const p of paths) {
    const res = await fetch(base + p, { headers: { cookie }, redirect: 'manual' });
    if (res.status !== 200) throw new Error(`Admin demo page ${p} returned ${res.status}`);
    pages.push([p, await res.text()]);
  }
  for (const [p, raw] of pages) {
    const html = raw
      .replace(/(name="(?:_csrf|_token)" value=")[^"]*"/g, '$1demo"')
      .replace(/<a ([^>]*?)href="(\/admin[^"#?]*)([^"]*)"/g, (m, pre, href, rest) => (have.has(href) ? m : `<a ${pre}href="#" data-demo-unavailable`))
      .replace('</body>', `${ADMIN_DEMO}\n${DEMO_TAG}\n</body>`);
    const file = path.join(OUT, toFile(p));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  }
  return pages.length;
}
const toFile = (p) => (p === '/' ? 'index.html' : p.replace(/^\//, '') + (path.extname(p) ? '' : '.html'));

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name); const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(path.join(ROOT, 'public'), OUT);

  const server = http.createServer((req, res) => app.handle(req, res));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const demoFiles = seedDemo();
  for (const f of demoFiles) { const dst = path.join(OUT, 'uploads', f.rel); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, f.data); }

  const demoSrc = fs.readFileSync(path.join(__dirname, 'demo-assets', 'demo.js'), 'utf8');
  if (!demoSrc.includes('/*__SEED__*/ { vacancies: [], flyers: [] }')) throw new Error('demo.js seed placeholder not found');
  fs.writeFileSync(path.join(OUT, 'assets', 'js', 'demo.js'), demoSrc.replace('/*__SEED__*/ { vacancies: [], flyers: [] }', () => JSON.stringify(buildSeed())));
  let jobTemplate = '';

  const queue = ['/', '/about', '/our-approach', '/programmes', '/careers', '/contact', '/news', '/privacy-policy', '/terms'];
  const seen = new Set();
  let pages = 0;
  while (queue.length) {
    const p = queue.shift();
    if (seen.has(p)) continue;
    seen.add(p);
    const res = await fetch(base + p, { redirect: 'manual' });
    if (res.status !== 200 || !/text\/html/.test(res.headers.get('content-type') || '')) continue;
    let html = await res.text();
    for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
      const link = m[1].replace(/\/$/, '') || '/';
      if (/^\/(admin|assets|uploads)(\/|$)/.test(link) || path.extname(link)) continue;
      if (!seen.has(link)) queue.push(link);
    }
    html = html.replace(/<form class="form" method="post"/g, '<form class="form" method="post" data-static-preview')
      .replace('</body>', `${PREVIEW_SCRIPT}\n</body>`);
    // The real site sends flyer files through /careers/flyers/:id/download; the static preview links the file itself.
    const flyerFiles = new Map(require('../src/db').q.all('SELECT id, file FROM flyers').map((f) => [String(f.id), f.file]));
    html = html.replace(/href="\/careers\/flyers\/(\d+)\/download"/g, (m, id) => (flyerFiles.get(id) ? `href="/uploads/${flyerFiles.get(id)}" download` : m));
    if (p === '/careers/english-tutor-sample') jobTemplate = html;
    if (p === '/' || p === '/careers') html = html.replace('</body>', `${DEMO_TAG}\n</body>`);
    const file = path.join(OUT, toFile(p));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    pages++;
  }

  if (!jobTemplate) throw new Error('Could not find the sample vacancy page to use as the demo vacancy template.');
  fs.writeFileSync(path.join(OUT, 'careers', 'job.html'), jobTemplate.replace('</body>', `${DEMO_TAG}\n</body>`));

  const adminPages = await exportAdmin(base);

  for (const p of ['/robots.txt', '/sitemap.xml']) {
    const res = await fetch(base + p);
    if (res.ok) fs.writeFileSync(path.join(OUT, toFile(p)), await res.text());
  }
  const nf = await fetch(base + '/this-page-does-not-exist');
  fs.writeFileSync(path.join(OUT, '404.html'), (await nf.text()).replace('</body>', `${PREVIEW_SCRIPT}\n</body>`));

  server.close();
  console.log(`Static preview: ${pages} pages + ${adminPages} admin demo pages written to ${path.relative(process.cwd(), OUT) || OUT}`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
