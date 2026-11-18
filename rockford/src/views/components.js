'use strict';
/* Shared public view helpers. Every value is escaped with h(). */
const { h, safeUrl, formToken } = require('../security');
const md = require('../markdown');
const { flyerUrl } = require('../uploads');

/** Responsive <img> for an image object { src, alt, stock }. Unsplash sources get a srcset. */
function picture(img, { eager = false, sizes = '(min-width: 900px) 50vw, 100vw', cls = 'ph__img' } = {}) {
  if (!img || !safeUrl(img.src)) return '';
  const src = safeUrl(img.src);
  let attrs;
  if (/^https:\/\/images\.unsplash\.com\//.test(src)) {
    const base = src + (src.includes('?') ? '&' : '?') + 'auto=format&fit=crop&q=70';
    attrs = `src="${h(base + '&w=1400')}" srcset="${[640, 1024, 1400, 2000].map((w) => h(`${base}&w=${w} ${w}w`)).join(', ')}" sizes="${h(sizes)}"`;
  } else {
    attrs = `src="${h(src)}"`;
  }
  const load = eager ? 'fetchpriority="high"' : 'loading="lazy"';
  return `<img class="${cls}" ${attrs} alt="${h(img.alt || '')}" decoding="async" ${load}>`;
}

/** Photo block used across the site. Falls back to a neutral placeholder when no image is set. */
function photo(img, opts = {}) {
  const tag = img && img.stock && safeUrl(img.src) ? '<span class="stock-label">Illustrative photo</span>' : '';
  return `<div class="ph${opts.cls ? ' ' + opts.cls : ''}"><div class="ph__art" aria-hidden="true"></div>${picture(img, { ...opts, cls: 'ph__img' })}${tag}${opts.caption ? `<span class="stagger__cap">${h(opts.caption)}</span>` : ''}</div>`;
}

const pill = (t, cls = '') => `<span class="pill ${cls}">${h(t)}</span>`;

const AVAILABILITY = { coming_soon: 'Coming soon', enrolling: 'Now enrolling', waitlist: 'Waitlist open', closed: 'Enrolment closed' };

function programmeCard(p) {
  const meta = [['For', p.audience], ['Duration', p.duration], ['Format', p.format]].filter((m) => m[1]);
  return `<article class="pub-card reveal" data-category="${h(p.category || '')}">
    <a class="pub-card__media" href="/programmes/${h(p.slug)}" tabindex="-1" aria-hidden="true">${photo(p.image_url ? { src: p.image_url, alt: p.image_alt } : null)}</a>
    <div class="pub-card__chips">${p.category ? pill('/' + p.category, 'pill--outline') : ''}<span class="chip chip--${h(p.availability)}">${h(AVAILABILITY[p.availability] || '')}</span></div>
    <h3 class="pub-card__title"><a href="/programmes/${h(p.slug)}">${h(p.title)}</a></h3>
    ${p.excerpt ? `<p class="pub-card__text">${h(p.excerpt)}</p>` : ''}
    ${meta.length ? `<dl class="pub-card__meta">${meta.map((m) => `<div><dt>${h(m[0])}</dt><dd>${h(m[1])}</dd></div>`).join('')}</dl>` : ''}
    <div class="pub-card__actions">
      <a class="pill-btn pill-btn--navy pill-btn--sm" href="/programmes/${h(p.slug)}#enquire" data-track="programme_interest" data-track-item="${h(p.slug)}">Enquire now</a>
      <a class="circle-arrow" href="/programmes/${h(p.slug)}" aria-label="View programme: ${h(p.title)}">↗</a>
    </div>
  </article>`;
}

function formatDate(v) {
  if (!v) return '';
  const d = typeof v === 'number' ? new Date(v) : new Date(String(v) + (String(v).length === 10 ? 'T00:00:00+05:30' : ''));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' });
}

function vacancyCard(v) {
  return `<li class="ev-card reveal" data-category="${h(v.category || '')}">
    <div class="ev-card__top"><span class="ev-card__date">${v.deadline ? 'Closes ' + h(formatDate(v.deadline)) : h(v.employment_type || 'Open')}</span>${v.category ? pill(v.category, 'pill--outline') : ''}</div>
    <h3 class="ev-card__title"><a href="/careers/${h(v.slug)}" data-track="vacancy_view" data-track-item="${h(v.slug)}">${h(v.title)}</a></h3>
    ${v.summary ? `<p class="ev-card__text">${h(v.summary)}</p>` : ''}
    <p class="ev-card__meta">${[v.employment_type, v.location].filter(Boolean).map(h).join(' · ')}</p>
    <a class="circle-arrow" href="/careers/${h(v.slug)}" aria-label="View vacancy: ${h(v.title)}">→</a>
  </li>`;
}

/** Job flyer card: an image, a PDF or typed words (all values escaped; file URLs come from flyerUrl()). */
function flyerCard(f) {
  const url = f.file ? flyerUrl(f.file) : '';
  const closes = f.deadline ? `<span class="ev-card__date">Closes ${h(formatDate(f.deadline))}</span>` : '<span class="ev-card__date">Job flyer</span>';
  const head = `<div class="ev-card__top">${closes}${pill(f.kind === 'pdf' ? 'PDF' : f.kind === 'image' ? 'Flyer' : 'Notice', 'pill--outline')}</div>
    <h3 class="ev-card__title">${h(f.title)}</h3>${f.summary ? `<p class="ev-card__text">${h(f.summary)}</p>` : ''}`;
  if (f.kind === 'image' && url) {
    return `<li class="flyer-card flyer-card--image reveal" data-kind="image">
    <a class="flyer-card__media" href="${h(url)}" target="_blank" rel="noopener" aria-label="Open the full flyer: ${h(f.title)}"><img src="${h(url)}" alt="${h(f.alt || f.title)}" loading="lazy" decoding="async"></a>
    ${head}
    <a class="pill-btn pill-btn--navy pill-btn--sm" href="${h(url)}" target="_blank" rel="noopener" data-track="flyer_view" data-track-item="${h(String(f.id))}">View full flyer</a>
  </li>`;
  }
  if (f.kind === 'pdf' && url) {
    return `<li class="flyer-card flyer-card--pdf reveal" data-kind="pdf">
    <div class="flyer-card__pdf" aria-hidden="true"><span>PDF</span></div>
    ${head}
    <div class="flyer-card__actions"><a class="pill-btn pill-btn--navy pill-btn--sm" href="${h(url)}" target="_blank" rel="noopener" data-track="flyer_view" data-track-item="${h(String(f.id))}">Open PDF</a> <a class="pill-btn pill-btn--sm pill-btn--outline" href="${h(url)}" download>Download</a></div>
  </li>`;
  }
  return `<li class="flyer-card flyer-card--text reveal" data-kind="text">
    ${head}
    <div class="prose flyer-card__body">${md.render(f.body)}</div>
  </li>`;
}

function articleCard(a) {
  return `<article class="pub-card reveal" data-category="${h(a.category || '')}">
    <a class="pub-card__media" href="/news/${h(a.slug)}" tabindex="-1" aria-hidden="true">${photo(a.image_url ? { src: a.image_url, alt: a.image_alt } : null)}</a>
    <div class="pub-card__chips">${a.category ? pill('/' + a.category, 'pill--outline') : ''}<span class="ev-card__date">${h(formatDate(a.published_at))}</span></div>
    <h3 class="pub-card__title"><a href="/news/${h(a.slug)}">${h(a.title)}</a></h3>
    ${a.excerpt ? `<p class="pub-card__text">${h(a.excerpt)}</p>` : ''}
  </article>`;
}

/* ── Form helpers ─────────────────────────────────────────── */
function field({ name, label, type = 'text', value = '', error = '', required = false, hint = '', autocomplete = '', attrs = '' }) {
  const id = 'f-' + name;
  const describedBy = [hint ? id + '-hint' : '', error ? id + '-err' : ''].filter(Boolean).join(' ');
  const common = `id="${id}" name="${h(name)}"${required ? ' required aria-required="true"' : ''}${error ? ' aria-invalid="true"' : ''}${describedBy ? ` aria-describedby="${describedBy}"` : ''}${autocomplete ? ` autocomplete="${autocomplete}"` : ''} ${attrs}`;
  const input = type === 'textarea'
    ? `<textarea ${common} rows="6">${h(value)}</textarea>`
    : `<input type="${type}" ${common} value="${h(value)}">`;
  return `<div class="field${error ? ' field--error' : ''}">
    <label for="${id}">${h(label)}${required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">(optional)</span>'}</label>
    ${hint ? `<p class="field__hint" id="${id}-hint">${h(hint)}</p>` : ''}
    ${input}
    ${error ? `<p class="field__error" id="${id}-err">${h(error)}</p>` : ''}
  </div>`;
}

/** Anti-spam fields: signed time token + honeypot (hidden from people and assistive tech). */
const antiSpam = () => `<input type="hidden" name="_t" value="${h(formToken())}">
  <div class="hp" aria-hidden="true"><label>Leave this field empty <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>`;

function errorSummary(errors) {
  const keys = Object.keys(errors || {}).filter((k) => errors[k]);
  if (!keys.length) return '';
  return `<div class="form-alert" role="alert" tabindex="-1" id="form-errors"><p><strong>${errors.form ? h(errors.form) : 'Please check the form.'}</strong></p>${keys.filter((k) => k !== 'form').length ? `<ul>${keys.filter((k) => k !== 'form').map((k) => `<li><a href="#f-${h(k)}">${h(errors[k])}</a></li>`).join('')}</ul>` : ''}</div>`;
}

module.exports = { picture, photo, pill, programmeCard, vacancyCard, flyerCard, articleCard, formatDate, field, antiSpam, errorSummary, AVAILABILITY };
