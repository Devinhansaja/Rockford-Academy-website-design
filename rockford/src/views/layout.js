'use strict';
/* Public page shell: <head> SEO, header, footer, analytics. */
const config = require('../config');
const { h, safeUrl } = require('../security');

const NAV = [
  ['/', 'Home'], ['/about', 'About Us'], ['/programmes', 'Programmes'], ['/our-approach', 'Our Approach'], ['/careers', 'Careers'], ['/contact', 'Contact'],
];

const abs = (p) => (config.siteUrl ? config.siteUrl + p : '');

/** Header logo: the complete Rockford crest exactly as supplied (brand rule: never crop, redraw or recolour).
 *  Only the plain white background around it is transparent. A logo uploaded in Admin overrides it. */
function logo(s) {
  const lu = safeUrl(s.logo_url);
  if (lu) return `<img class="logo__img" src="${h(lu)}" alt="${h(s.site_name)}">`;
  return `<img class="logo__head" src="/assets/brand/rockford-logo.webp" width="640" height="711" alt="${h(s.site_name)}: English Academy">`;
}

/** Footer logo: the full crest with wordmark, banner and "Est. 2026". */
function fullLogo(s) {
  const lu = safeUrl(s.logo_url);
  if (lu) return `<img class="logo__img" src="${h(lu)}" alt="${h(s.site_name)}">`;
  return `<img class="logo__full" src="/assets/brand/rockford-logo.webp" width="640" height="711" alt="${h(s.site_name)}: English Academy, established 2026" loading="lazy">`;
}

function analyticsHead(ctx) {
  const s = ctx.settings; const n = h(ctx.nonce);
  let out = '';
  if (s.gtm_id) {
    out += `<script nonce="${n}">(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;var n=d.querySelector('[nonce]');n&&j.setAttribute('nonce',n.nonce||n.getAttribute('nonce'));f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(s.gtm_id)});</script>`;
  } else if (s.ga4_id) {
    out += `<script async src="https://www.googletagmanager.com/gtag/js?id=${h(s.ga4_id)}"></script>
<script nonce="${n}">window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(s.ga4_id)},{anonymize_ip:true});</script>`;
  }
  return out;
}

/** Announcement bar: on, has text, and today (Sri Lanka time) is within the optional date window. */
function announcement(s) {
  if (!s.announcement_enabled || !s.announcement_text) return '';
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  if (s.announcement_start && today < s.announcement_start) return '';
  if (s.announcement_end && today > s.announcement_end) return '';
  const link = safeUrl(s.announcement_link);
  const ext = /^https?:/i.test(link);
  return `<div class="announce" role="region" aria-label="Announcement"><p class="announce__inner"><span class="announce__dot" aria-hidden="true"></span><span>${h(s.announcement_text)}</span>${link ? ` <a href="${h(link)}"${ext ? ' rel="noopener" target="_blank"' : ''} data-track="announcement_click">${h(s.announcement_link_label || 'Learn more')} →</a>` : ''}</p></div>`;
}

function header(ctx, current) {
  const s = ctx.settings;
  const navLinks = NAV.map(([href, label]) => `<li><a href="${href}"${current === href ? ' aria-current="page"' : ''}>${label}</a></li>`).join('');
  const mobileLinks = NAV.map(([href, label], i) => `<li><a href="${href}"${current === href ? ' aria-current="page"' : ''}><span>/0${i + 1}</span>${label}</a></li>`).join('');
  return `<header class="site-header" data-header>
  ${announcement(s)}
  <div class="site-header__inner">
    <a class="logo-tab" href="/" aria-label="${h(s.site_name)}: home">${logo(s)}</a>
    <nav class="primary-nav" aria-label="Primary"><ul>${navLinks}</ul></nav>
    <a class="pill-btn pill-btn--gold site-header__cta" href="/contact" data-track="cta_get_in_touch">Get in Touch <span aria-hidden="true">→</span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" data-menu-toggle>
      <span class="menu-toggle__label">Menu</span><span class="menu-toggle__icon" aria-hidden="true"><i></i><i></i></span>
    </button>
  </div>
  <div class="mobile-menu" id="mobile-menu" hidden data-mobile-menu>
    <nav aria-label="Mobile"><ol class="mobile-menu__list">${mobileLinks}</ol>
      <a class="pill-btn pill-btn--gold mobile-menu__cta" href="/contact">Get in touch</a></nav>
  </div>
</header>`;
}

function footer(ctx, programmes) {
  const s = ctx.settings;
  const contact = [];
  if (s.contact_address) contact.push(`<li>${h(s.contact_address).replace(/\n/g, '<br>')}</li>`);
  if (s.contact_phone) contact.push(`<li><a href="tel:${h(s.contact_phone.replace(/[^\d+]/g, ''))}">${h(s.contact_phone)}</a></li>`);
  if (s.contact_whatsapp) contact.push(`<li><a href="https://wa.me/${h(s.contact_whatsapp)}" rel="noopener" target="_blank" data-track="whatsapp_click">WhatsApp</a></li>`);
  if (s.contact_email) contact.push(`<li><a href="mailto:${h(s.contact_email)}">${h(s.contact_email)}</a></li>`);
  contact.push('<li><a href="/contact">Send us a message</a></li>');
  const social = (s.social || []).filter((x) => safeUrl(x.url) && /^https:/.test(x.url))
    .map((x) => `<li><a class="pill-btn pill-btn--outline-light pill-btn--sm" href="${h(x.url)}" rel="noopener" target="_blank">${h(x.label)}</a></li>`).join('');
  const progLinks = (programmes || []).slice(0, 5).map((p) => `<li><a href="/programmes/${h(p.slug)}">${h(p.title)}</a></li>`).join('');
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="site-footer__top">
      <a class="site-footer__brand" href="/" aria-label="${h(s.site_name)}: home">${fullLogo(s)}</a>
      <nav class="site-footer__col" aria-label="About"><h2 class="site-footer__heading">About</h2><ul>
        <li><a href="/about">Our story</a></li><li><a href="/our-approach">Our approach</a></li><li><a href="/news">News &amp; insights</a></li></ul></nav>
      <nav class="site-footer__col" aria-label="Programmes"><h2 class="site-footer__heading">Programmes</h2><ul>${progLinks}<li><a href="/programmes">All programmes</a></li></ul></nav>
      <nav class="site-footer__col" aria-label="Careers"><h2 class="site-footer__heading">Careers</h2><ul><li><a href="/careers">Join our team</a></li><li><a href="/careers#vacancies">Current vacancies</a></li></ul></nav>
      <div class="site-footer__col"><h2 class="site-footer__heading">Contact</h2><ul>${contact.join('')}</ul></div>
      <div class="site-footer__pills">
        <a class="pill-btn pill-btn--outline-light pill-btn--sm" href="/contact">Get in touch</a>
        <a class="pill-btn pill-btn--outline-light pill-btn--sm" href="/careers">Careers</a>
        <a class="pill-btn pill-btn--outline-light pill-btn--sm" href="/programmes">Programmes</a>
        ${social ? `<ul class="social" aria-label="Social media">${social}</ul>` : ''}
      </div>
    </div>
    <div class="site-footer__bottom">
      <p>© ${new Date().getFullYear()} ${h(s.site_name)} · ${h(s.tagline)}</p>
      <ul><li><a href="/privacy-policy">Privacy policy</a></li><li><a href="/terms">Terms &amp; conditions</a></li></ul>
    </div>
  </div>
</footer>`;
}

/**
 * page(ctx, {
 *   title, description, path, image, type, noindex, jsonLd: [], current, intro, main, footerProgrammes
 * })
 */
function page(ctx, o) {
  const s = ctx.settings;
  const fullTitle = o.title ? `${o.title} | ${s.site_name}` : `${s.site_name}: ${s.home_hero_line1} ${s.home_hero_line2}`;
  const desc = o.description || s.seo_default_description;
  const canonical = abs(o.path || ctx.path);
  const ogImg = safeUrl(o.image || s.og_image_url);
  const ogAbs = ogImg && ogImg.startsWith('/') ? abs(ogImg) : ogImg;
  const ld = (o.jsonLd || []).filter(Boolean).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n');
  const introScript = o.intro
    ? `<script nonce="${h(ctx.nonce)}">(function(d){if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;d.classList.add('intro');setTimeout(function(){d.classList.add('intro-play')},2500)})(document.documentElement)</script>`
    : '';
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(fullTitle)}</title>
<meta name="description" content="${h(desc)}">
${o.noindex ? '<meta name="robots" content="noindex">' : ''}
${canonical && !o.noindex ? `<link rel="canonical" href="${h(canonical)}">` : ''}
<meta name="theme-color" content="#142747">
<meta property="og:type" content="${h(o.type || 'website')}">
<meta property="og:site_name" content="${h(s.site_name)}">
<meta property="og:title" content="${h(o.title || s.site_name)}">
<meta property="og:description" content="${h(desc)}">
${canonical ? `<meta property="og:url" content="${h(canonical)}">` : ''}
${ogAbs ? `<meta property="og:image" content="${h(ogAbs)}">` : ''}
<meta name="twitter:card" content="${ogAbs ? 'summary_large_image' : 'summary'}">
${s.search_console_verification ? `<meta name="google-site-verification" content="${h(s.search_console_verification)}">` : ''}
<link rel="icon" href="/assets/brand/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/assets/brand/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=Inter:wght@300;400;500;600&family=Instrument+Serif&family=Manrope:wght@700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/main.css?v=8">
${introScript}
${analyticsHead(ctx)}
${ld}
<script src="/assets/js/main.js?v=5" defer></script>
</head>
<body class="${h([o.bodyClass, announcement(s) ? 'has-announce' : ''].filter(Boolean).join(' '))}">
<a class="skip-link" href="#main">Skip to content</a>
<div class="scroll-progress" aria-hidden="true" data-progress></div>
${header(ctx, o.current)}
<main id="main">
${o.main}
</main>
${footer(ctx, o.footerProgrammes)}
<button class="to-top" type="button" aria-label="Back to top" data-to-top>↑</button>
</body>
</html>`;
}

/** Standard inner-page hero (navy band with label + statement). */
function pageHero({ label, title, intro = '', image = null, photoHtml = '' }) {
  return `<section class="page-hero">
  <div class="wrap lead-row">
    <p class="tiny-label tiny-label--light">${h(label)}</p>
    <div>
      <h1 class="statement statement--xl" data-split>${h(title)}</h1>
      ${intro ? `<p class="lead-row__text reveal">${h(intro)}</p>` : ''}
    </div>
  </div>
  ${photoHtml ? `<div class="page-hero__photo wrap">${photoHtml}</div>` : ''}
</section>`;
}

module.exports = { page, pageHero, abs };
