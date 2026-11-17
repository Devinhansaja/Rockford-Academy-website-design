'use strict';
/*
 * Static preview export (used by Vercel).
 *
 * Vercel cannot run this site as-is: it needs a long-running server and a writable disk for the
 * SQLite database, sessions and CV uploads. This script renders every public page with the real
 * templates into ./dist as plain HTML so the DESIGN can be previewed on any static host.
 * The admin panel and forms do not work in this preview; deploy the Node server for the live site
 * (see docs/DEPLOY.md).
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
    const file = path.join(OUT, toFile(p));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    pages++;
  }

  for (const p of ['/robots.txt', '/sitemap.xml']) {
    const res = await fetch(base + p);
    if (res.ok) fs.writeFileSync(path.join(OUT, toFile(p)), await res.text());
  }
  const nf = await fetch(base + '/this-page-does-not-exist');
  fs.writeFileSync(path.join(OUT, '404.html'), (await nf.text()).replace('</body>', `${PREVIEW_SCRIPT}\n</body>`));

  server.close();
  console.log(`Static preview: ${pages} pages written to ${path.relative(process.cwd(), OUT) || OUT}`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
