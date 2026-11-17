'use strict';
/* robots.txt and sitemap.xml */
const config = require('../config');
const { q } = require('../db');
const content = require('../content');
const { h } = require('../security');

function origin(ctx) {
  if (config.siteUrl) return config.siteUrl;
  // Development fallback only. Set SITE_URL in production so URLs are canonical.
  return `http://${String(ctx.req.headers.host || 'localhost').replace(/[^\w.:-]/g, '')}`;
}

function register(app) {
  const r = app.router;

  r.get('/robots.txt', (ctx) => {
    const lines = ['User-agent: *', 'Disallow: /admin', 'Disallow: /thank-you', 'Disallow: /enquire', ''];
    if (config.siteUrl) lines.push(`Sitemap: ${config.siteUrl}/sitemap.xml`);
    ctx.text(lines.join('\n'), 200, 'text/plain; charset=utf-8');
  });

  r.get('/sitemap.xml', (ctx) => {
    const base = origin(ctx);
    const urls = [
      ['/', null, '1.0'], ['/about', null, '0.8'], ['/programmes', null, '0.9'], ['/our-approach', null, '0.7'],
      ['/careers', null, '0.9'], ['/contact', null, '0.7'], ['/news', null, '0.6'], ['/privacy-policy', null, '0.2'], ['/terms', null, '0.2'],
    ];
    for (const p of content.programmes()) urls.push(['/programmes/' + p.slug, p.updated_at, '0.8']);
    for (const v of content.vacancies()) urls.push(['/careers/' + v.slug, v.updated_at, '0.7']);
    for (const a of q.all("SELECT slug, updated_at FROM articles WHERE status = 'published' AND published_at <= ?", Date.now())) urls.push(['/news/' + a.slug, a.updated_at, '0.5']);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([p, t, pr]) => `  <url><loc>${h(base + p)}</loc>${t ? `<lastmod>${new Date(t).toISOString().slice(0, 10)}</lastmod>` : ''}<priority>${pr}</priority></url>`).join('\n')}
</urlset>`;
    ctx.text(xml, 200, 'application/xml; charset=utf-8');
  });
}

module.exports = { register };
