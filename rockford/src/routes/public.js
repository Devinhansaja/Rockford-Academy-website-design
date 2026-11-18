'use strict';
/* Public pages. */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const uploads = require('../uploads');
const content = require('../content');
const md = require('../markdown');
const { page, abs } = require('../views/layout');
const { home } = require('../views/home');
const P = require('../views/pages');

const orgLd = (s) => {
  // With a confirmed address the academy is also a LocalBusiness (local SEO, brief §6)
  const o = { '@context': 'https://schema.org', '@type': s.contact_address ? ['EducationalOrganization', 'LocalBusiness'] : 'EducationalOrganization', name: s.site_name, slogan: s.tagline, description: s.seo_default_description, areaServed: { '@type': 'Country', name: 'Sri Lanka' } };
  if (config.siteUrl) o.url = config.siteUrl;
  if (s.contact_phone) o.telephone = s.contact_phone;
  if (s.contact_email) o.email = s.contact_email;
  if (s.contact_address) o.address = { '@type': 'PostalAddress', streetAddress: s.contact_address.replace(/\n/g, ', '), addressCountry: 'LK' };
  const sameAs = (s.social || []).map((x) => x.url).filter((u) => /^https:/.test(u || ''));
  if (sameAs.length) o.sameAs = sameAs;
  return o;
};

const crumbs = (items) => (config.siteUrl ? {
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
} : null);

const EMPLOYMENT = { 'Full-time': 'FULL_TIME', 'Part-time': 'PART_TIME', Contract: 'CONTRACTOR', Visiting: 'PART_TIME', Internship: 'INTERN' };

function render(ctx, o, status = 200) {
  ctx.html(page(ctx, { footerProgrammes: content.programmes(), ...o }), status);
}

/* Exposed so form handlers can re-render pages with validation errors. */
const renderers = {
  contact(ctx, form = {}, status = 200) {
    render(ctx, { title: 'Contact us', description: 'Contact Rockford Academy about programmes, careers or partnerships.', path: '/contact', current: '/contact', main: P.contact(ctx, { programmes: content.programmes(), form }) }, status);
  },
  programme(ctx, p, form = {}, status = 200) {
    const ld = { '@context': 'https://schema.org', '@type': 'Course', name: p.title, description: p.seo_description || p.excerpt || md.plain(p.body), provider: { '@type': 'EducationalOrganization', name: ctx.settings.site_name } };
    if (config.siteUrl) { ld.url = abs('/programmes/' + p.slug); ld.provider.sameAs = config.siteUrl; }
    render(ctx, {
      title: p.seo_title || p.title, description: p.seo_description || p.excerpt || md.plain(p.body), path: '/programmes/' + p.slug, current: '/programmes', image: p.image_url,
      jsonLd: [ld, crumbs([['Programmes', '/programmes'], [p.title, '/programmes/' + p.slug]])],
      main: P.programme(ctx, { p, form }),
    }, status);
  },
  vacancy(ctx, v, form = {}, status = 200) {
    const open = content.vacancyIsOpen(v);
    let ld = null;
    if (open) {
      ld = {
        '@context': 'https://schema.org', '@type': 'JobPosting', title: v.title,
        description: md.render(v.description) || v.summary || v.title,
        datePosted: new Date(v.published_at || v.created_at).toISOString().slice(0, 10),
        hiringOrganization: { '@type': 'Organization', name: ctx.settings.site_name, ...(config.siteUrl ? { sameAs: config.siteUrl } : {}) },
      };
      if (v.deadline) ld.validThrough = v.deadline + 'T23:59:59+05:30';
      if (EMPLOYMENT[v.employment_type]) ld.employmentType = EMPLOYMENT[v.employment_type];
      if (v.location) ld.jobLocation = { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: v.location, addressCountry: 'LK' } };
      else ld.applicantLocationRequirements = { '@type': 'Country', name: 'Sri Lanka' };
    }
    render(ctx, {
      title: v.seo_title || v.title, description: v.seo_description || v.summary || md.plain(v.description), path: '/careers/' + v.slug, current: '/careers',
      jsonLd: [ld, crumbs([['Careers', '/careers'], [v.title, '/careers/' + v.slug]])],
      main: P.vacancy(ctx, { v, form, open }),
    }, status);
  },
  careers(ctx, form = {}, status = 200) {
    render(ctx, { title: 'Careers: join our team', description: ctx.settings.home_careers_lede, path: '/careers', current: '/careers', main: P.careers(ctx, { vacancies: content.vacancies(), flyers: content.flyers(), form }) }, status);
  },
};

function register(app) {
  const r = app.router;

  r.get('/', (ctx) => render(ctx, {
    path: '/', current: '/', bodyClass: 'page-home',
    jsonLd: [orgLd(ctx.settings), config.siteUrl ? { '@context': 'https://schema.org', '@type': 'WebSite', name: ctx.settings.site_name, url: config.siteUrl } : null],
    main: home(ctx, { programmes: content.programmes(), vacancies: content.vacancies(), testimonials: content.testimonials(), articles: content.articles(3) }),
  }));

  r.get('/about', (ctx) => render(ctx, { title: 'About us', description: 'Why Rockford Academy exists: an English and personality development academy in Sri Lanka, focused on communication skills, confidence and opportunity for young people.', path: '/about', current: '/about', main: P.about(ctx), jsonLd: [orgLd(ctx.settings)] }));
  r.get('/our-approach', (ctx) => render(ctx, { title: 'Our approach', description: 'Real skills, real experiences, real growth: how Rockford Academy builds spoken English, communication skills and confidence for young adults through practice.', path: '/our-approach', current: '/our-approach', main: P.approach(ctx) }));

  r.get('/programmes', (ctx) => render(ctx, { title: 'Programmes', description: 'English and personality development programmes in Sri Lanka: spoken English, communication skills training and confidence building for young people.', path: '/programmes', current: '/programmes', main: P.programmes(ctx, { list: content.programmes() }) }));
  r.get('/programmes/:slug', (ctx) => {
    const p = content.programme(ctx.params.slug);
    if (!p) return false; // falls through to 404
    renderers.programme(ctx, p);
  });

  r.get('/careers', (ctx) => renderers.careers(ctx));
  /** Job flyer file download with a friendly file name (e.g. "English Tutor.docx"). */
  r.get('/careers/flyers/:id/download', (ctx) => {
    const f = /^\d{1,12}$/.test(ctx.params.id) ? content.flyer(Number(ctx.params.id)) : null;
    if (!f || !uploads.flyerUrl(f.file)) return false;
    const file = path.join(config.UPLOADS_DIR, f.file);
    let st = null; try { st = fs.statSync(file); } catch { st = null; }
    if (!st || !st.isFile()) return false;
    const ext = path.extname(f.file);
    const base = String(f.title).normalize('NFKD').replace(/[^A-Za-z0-9 ._()-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'flyer';
    ctx.res.writeHead(200, {
      'Content-Type': f.mime || 'application/octet-stream', 'Content-Length': st.size,
      'Content-Disposition': `attachment; filename="${base}${ext}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=3600',
    });
    if (ctx.req.method === 'HEAD') return ctx.res.end();
    fs.createReadStream(file).on('error', () => ctx.res.destroy()).pipe(ctx.res);
  });  r.get('/careers/:slug', (ctx) => {
    const v = content.vacancy(ctx.params.slug);
    if (!v) return false;
    renderers.vacancy(ctx, v);
  });

  r.get('/contact', (ctx) => renderers.contact(ctx));

  r.get('/news', (ctx) => render(ctx, { title: 'News & insights', description: 'News and insights from Rockford Academy.', path: '/news', current: '/news', main: P.news(ctx, { list: content.articles() }) }));
  r.get('/news/:slug', (ctx) => {
    const a = content.article(ctx.params.slug);
    if (!a) return false;
    const more = content.articles(4).filter((x) => x.id !== a.id).slice(0, 3);
    const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: a.title, datePublished: new Date(a.published_at).toISOString(), dateModified: new Date(a.updated_at).toISOString(), author: { '@type': 'Organization', name: ctx.settings.site_name }, publisher: { '@type': 'Organization', name: ctx.settings.site_name } };
    if (a.image_url && /^https?:/.test(a.image_url)) ld.image = a.image_url; else if (a.image_url && config.siteUrl) ld.image = abs(a.image_url);
    render(ctx, { title: a.seo_title || a.title, description: a.seo_description || a.excerpt || md.plain(a.body), path: '/news/' + a.slug, current: '/news', type: 'article', image: a.image_url, jsonLd: [ld, crumbs([['News', '/news'], [a.title, '/news/' + a.slug]])], main: P.article(ctx, { a, more }) });
  });

  r.get('/privacy-policy', (ctx) => render(ctx, { title: 'Privacy policy', path: '/privacy-policy', main: P.legal(ctx, { title: 'Privacy policy', body: ctx.settings.legal_privacy }) }));
  r.get('/terms', (ctx) => render(ctx, { title: 'Terms & conditions', path: '/terms', main: P.legal(ctx, { title: 'Terms & conditions', body: ctx.settings.legal_terms }) }));

  r.get('/thank-you', (ctx) => render(ctx, {
    title: 'Thank you', noindex: true, path: '/thank-you',
    main: P.thanks(ctx, { kind: ctx.query.form === 'application' ? 'application' : 'enquiry', ref: /^RA-(APP|ENQ)-\d{4}-[A-Z0-9]{6}$/.test(ctx.query.ref || '') ? ctx.query.ref : '', delivered: ctx.query.e === '1' }),
  }));

  // Friendly redirects for common alternate URLs
  for (const [from, to] of [['/about-us', '/about'], ['/approach', '/our-approach'], ['/contact-us', '/contact'], ['/jobs', '/careers'], ['/privacy', '/privacy-policy']]) {
    r.get(from, (ctx) => ctx.redirect(to, 301));
  }

  app.setNotFound((ctx) => render(ctx, { title: 'Page not found', noindex: true, main: P.notFound() }, 404));
  app.setErrorHandler((ctx) => {
    try { render(ctx, { title: 'Something went wrong', noindex: true, main: P.serverError() }, 500); }
    catch { ctx.text('Something went wrong', 500); }
  });
}

module.exports = { register, renderers };
