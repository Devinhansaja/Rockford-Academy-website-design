'use strict';
/*
 * Homepage — "Cinematic Premium" design (client-selected Concept B).
 * All copy comes from Site Settings; lists come from the database. Nothing is invented:
 * empty programme / vacancy / testimonial / article lists show honest states or are hidden.
 */
const { h } = require('../security');
const { picture, photo, programmeCard, articleCard, formatDate } = require('./components');

const DIMENSIONS = [
  ['personal', 'Spoken English & Communication Skills', 'Find your voice.'],
  ['personal', 'Confidence Building & Self-Expression', 'Express yourself with clarity.'],
  ['personal', 'Personality Development & Interpersonal Skills', 'Build meaningful connections.'],
  ['professional', 'Critical Thinking & Problem-Solving', 'Think beyond the obvious.'],
  ['professional', 'Professional Etiquette & Workplace Readiness', 'Prepare for the real world.'],
  ['future', 'Digital Awareness & Future Readiness', 'Adapt to a changing world.'],
];

const PRINCIPLES = [
  ['Real-world communication', 'Conversations, interviews and presentations modelled on real situations.'],
  ['Interactive learning', 'Discussion and activity rather than lectures and memorisation.'],
  ['Practical experiences', 'Skills practised and reflected on until they feel natural.'],
  ['Personal development', 'Character, self-awareness and self-belief alongside language.'],
  ['Collaborative activities', 'Teamwork, debate and shared problem-solving.'],
  ['Confidence through participation', 'Every learner speaks, contributes and leads.'],
];

const STEPS = [
  ['Discover', 'Discover your potential, your strengths and the direction you want to grow in.'],
  ['Develop', 'Develop essential capabilities in communication, confidence and critical thinking.'],
  ['Practise', 'Practise through real-world experiences: discussions, presentations and role-play.'],
  ['Transform', 'Transform the way you approach opportunities in education, employment and life.'],
];

const ROMAN = ['i.', 'ii.', 'iii.', 'iv.', 'v.', 'vi.'];

/** Split a heading line into animated words; optionally italicise + shimmer the last word. */
function words(text, startIndex, shineLast) {
  const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
  return parts.map((w, i) => {
    const inner = h(w);
    const isLast = i === parts.length - 1;
    return shineLast && isLast
      ? `<i class="w" style="--i:${startIndex + i}">${inner}</i>`
      : `<span class="w" style="--i:${startIndex + i}">${inner}</span>`;
  }).join(' ');
}

/* Glass information bar under the hero headline (thin-outline icons, 24px grid). */
const ICON = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const HIGHLIGHTS = [
  ['Communication', 'Find your voice.', ICON('<path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/>')],
  ['Confidence', 'Unlock your potential.', ICON('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>')],
  ['Personal Development', 'Become your best self.', ICON('<circle cx="12" cy="7" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 4.5l1.5-1.5M19.5 7H21"/>')],
  ['Future Readiness', 'Prepare for tomorrow.', ICON('<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>')],
  ['Practical Learning', 'Real skills for real life.', ICON('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>')],
];

/** Homepage hero on White: Slate headline on the left, framed crossfading photo slideshow on the right, info bar below. */
function luxHero(s, line1Count) {
  const fallback = s.images && s.images.hero ? [s.images.hero] : [];
  const slides = (Array.isArray(s.hero_slides) && s.hero_slides.filter((x) => x && x.src).length ? s.hero_slides.filter((x) => x && x.src) : fallback).slice(0, 5);
  const n = slides.length;
  const pad = (i) => String(i).padStart(2, '0');
  const slideHtml = slides.map((im, i) => `<div class="lux-slide${i === 0 ? ' is-active' : ''}" data-slide role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}"${i ? ' aria-hidden="true"' : ''}>
      ${picture(im, { eager: i === 0, sizes: '(min-width: 1000px) 45vw, 100vw', cls: 'lux-slide__img' })}
      ${im.stock ? '<span class="stock-label">Illustrative photo</span>' : ''}
    </div>`).join('');
  const controls = n > 1 ? `<div class="lux-controls" data-slider-controls>
        <button class="lux-ctl" type="button" data-slide-prev aria-label="Previous photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
        <ol class="lux-dots">${slides.map((_, i) => `<li><button type="button" class="lux-dot${i === 0 ? ' is-active' : ''}" data-slide-to="${i}" aria-label="Show photo ${i + 1}"${i === 0 ? ' aria-current="true"' : ''}><span class="lux-dot__fill"></span></button></li>`).join('')}</ol>
        <button class="lux-ctl" type="button" data-slide-next aria-label="Next photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
        <p class="lux-count" aria-hidden="true"><b data-slide-num>01</b><span>/</span>${pad(n)}</p>
        <button class="lux-ctl lux-ctl--play" type="button" data-slide-toggle aria-label="Pause slideshow" aria-pressed="false">
          <svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>
          <svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>
        </button>
      </div>` : '';
  return `<section class="lux-hero" aria-labelledby="hero-title" data-hero-slider data-interval="6000" aria-roledescription="carousel">
  <div class="lux-hero__frame">
    <div class="lux-hero__text">
      <p class="lux-eyebrow">${h(s.home_hero_eyebrow || 'A world of opportunity')}</p>
      <h1 class="lux-title" id="hero-title"><span class="lux-title__line">${words(s.home_hero_line1, 0, false)}</span> <span class="lux-title__line">${words(s.home_hero_line2, line1Count, false)}</span></h1>
      <p class="lux-lede">${h(s.home_hero_sub)}</p>
      <div class="lux-actions">
        <a class="lux-btn lux-btn--gold" href="/programmes" data-track="cta_explore_programmes">Explore Our Programmes <span aria-hidden="true">→</span></a>
        <a class="lux-btn lux-btn--line" href="/about" data-track="cta_discover">Discover Rockford <span aria-hidden="true">→</span></a>
      </div>
    </div>
    <div class="lux-hero__visual">
      <div class="lux-hero__slides" aria-live="off">${slideHtml}</div>
      ${controls}
    </div>
    <div class="lux-hero__bottom">
      <ul class="lux-glass" aria-label="What Rockford develops">${HIGHLIGHTS.map(([t, d, ic]) => `<li class="lux-glass__item"><span class="lux-glass__icon">${ic}</span><span><b>${h(t)}</b><small>${h(d)}</small></span></li>`).join('')}</ul>
    </div>
  </div>
</section>`;
}

/** Contact block (brief §5 "08 — Contact"): only confirmed details from Site Settings are shown. */
function contactStrip(s) {
  const rows = [];
  if (s.contact_address) rows.push(['Visit us', h(s.contact_address).replace(/\n/g, '<br>')]);
  if (s.contact_phone) rows.push(['Call', `<a href="tel:${h(s.contact_phone.replace(/[^\d+]/g, ''))}">${h(s.contact_phone)}</a>`]);
  if (s.contact_whatsapp) rows.push(['WhatsApp', `<a href="https://wa.me/${h(s.contact_whatsapp)}" rel="noopener" target="_blank" data-track="whatsapp_click">Message us</a>`]);
  if (s.contact_email) rows.push(['Email', `<a href="mailto:${h(s.contact_email)}">${h(s.contact_email)}</a>`]);
  if (s.opening_hours) rows.push(['Opening hours', h(s.opening_hours).replace(/\n/g, '<br>')]);
  const map = /^https:\/\/www\.google\.com\/maps\/embed\?/.test(s.map_embed_url || '') ? s.map_embed_url : '';
  if (!rows.length && !map) return '';
  return `${rows.length ? `<dl class="contact-strip reveal">${rows.map(([k, v]) => `<div><dt>${h(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
    ${map ? `<div class="home-map reveal"><iframe src="${h(map)}" title="Map showing the Rockford Academy location" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : ''}`;
}

function home(ctx, { programmes, vacancies, testimonials, articles }) {
  const s = ctx.settings; const img = s.images || {};
  const gallery = (img.gallery || []).slice(0, 4);
  const line1Count = String(s.home_hero_line1 || '').trim().split(/\s+/).length;

  const programmesBlock = programmes.length
    ? `<div class="pub-grid">${programmes.slice(0, 4).map(programmeCard).join('')}</div>
       ${programmes.length > 4 ? '<div class="center-row"><a class="pill-btn pill-btn--navy" href="/programmes">All programmes →</a></div>' : ''}`
    : `<div class="pub-grid">
        <article class="pub-card reveal">
          <div class="pub-card__media">${photo(img.programmes)}</div>
          <div class="pub-card__chips"><span class="chip chip--coming_soon">Coming soon</span></div>
          <h3 class="pub-card__title">Our first programmes are being designed now</h3>
          <p class="pub-card__text">Programme details will be published here once they are confirmed.</p>
        </article>
        <article class="pub-card pub-card--cta reveal" style="--d:.1s">
          <p class="tiny-label">Stay informed</p>
          <h3 class="pub-card__title">Be the first to know when enrolment opens</h3>
          <p class="pub-card__text">Leave your details and we will contact you as soon as programmes are announced.</p>
          <a class="pill-btn pill-btn--navy" href="/contact?topic=programmes" data-track="programme_interest">Register your interest →</a>
        </article>
      </div>`;

  const vacancyBlock = vacancies.length
    ? vacancies.slice(0, 4).map((v) => `<li><a href="/careers/${h(v.slug)}" data-track="vacancy_view" data-track-item="${h(v.slug)}">
        <span class="t">${h(v.title)}</span>
        <span class="m">${[v.employment_type, v.location, v.deadline ? 'Closes ' + formatDate(v.deadline) : ''].filter(Boolean).map(h).join(' · ')}</span>
        <span class="circle-arrow" aria-hidden="true">→</span></a></li>`).join('')
    : `<li class="empty">New roles will be announced here soon.${s.eoi_enabled ? ' You can already send us an expression of interest.' : ''}</li>`;

  const stories = testimonials.length ? `
<section class="stories" aria-labelledby="stories-title">
  <div class="wrap stories__grid">
    <div><p class="tiny-label">Testimonials</p><h2 class="serif-title" id="stories-title">Learner <em>stories</em></h2></div>
    <ul class="stories__list">${testimonials.map((t) => `<li class="quote-card reveal">
      <blockquote><p>“${h(t.quote)}”</p></blockquote>
      <p class="quote-card__who">${t.image_url ? picture({ src: t.image_url, alt: '' }, { cls: 'quote-card__img' }) : ''}<span><strong>${h(t.name)}</strong>${t.role ? h(t.role) : ''}</span></p>
      ${t.video_url ? `<div class="quote-card__video"><iframe src="${h(t.video_url)}" title="Video testimonial from ${h(t.name)}" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>` : ''}
    </li>`).join('')}</ul>
  </div>
</section>` : '';

  const news = articles.length ? `
<section class="section-pad surface-light" aria-labelledby="news-title">
  <div class="wrap">
    <div class="head-split"><h2 class="big-title reveal" id="news-title">News &amp; <em>insights</em></h2><p class="caps-sub reveal">Updates, ideas and stories from Rockford Academy.</p></div>
    <div class="pub-grid pub-grid--3">${articles.slice(0, 3).map(articleCard).join('')}</div>
    <div class="center-row"><a class="pill-btn pill-btn--outline" href="/news">All news →</a></div>
  </div>
</section>` : '';

  return `
${luxHero(s, line1Count)}

<section class="cine-statement paper" id="purpose" aria-labelledby="purpose-title">
  <div class="wrap two-col">
    <p class="tiny-label">Our purpose</p>
    <div>
      <h2 class="serif-xl" id="purpose-title" data-split>${h(s.home_about_statement)}</h2>
      <p class="muted reveal">${h(s.home_about_text)}</p>
      <a class="pill-btn pill-btn--outline-light reveal" href="/about">Our story →</a>
    </div>
  </div>
</section>

<section class="cine-vm surface-light" aria-labelledby="vm-title">
  <div class="wrap">
    <h2 class="tiny-label" id="vm-title" style="margin-bottom:40px">Vision &amp; mission</h2>
    <div class="vm2">
      <article class="vm2__item reveal"><p class="tiny-label">Our vision</p><p class="vm2__text">To empower a generation of confident, capable and opportunity-ready individuals.</p></article>
      <article class="vm2__item reveal" style="--d:.12s"><p class="tiny-label">Our mission</p><p class="vm2__text">To equip young people with the communication, personal and professional skills necessary to succeed in education, employment and life.</p></article>
    </div>
    <p class="promise-line reveal">Our promise: <i>helping people become more confident, capable and ready for opportunities.</i></p>
  </div>
</section>

<section class="cine-cards paper" id="dimensions" aria-labelledby="dimensions-title">
  <div class="wrap">
    <div class="head-split"><h2 class="big-title reveal" id="dimensions-title">What we <em>develop</em></h2><p class="caps-sub reveal">${h(s.home_dims_intro)}</p></div>
    <ol class="glow-grid">${DIMENSIONS.map(([, t, d], i) => `<li class="glow reveal" style="--d:${(i % 3) * 0.08}s"><span class="glow__num">${ROMAN[i]}</span><h3>${h(t)}</h3><p>${h(d)}</p></li>`).join('')}</ol>
  </div>
</section>

<div class="marquee surface-light" role="region" aria-label="What we develop">
  <div class="marquee__track">
    ${[0, 1].map((dup) => `<ul class="marquee__group"${dup ? ' aria-hidden="true"' : ''}>${['Spoken English', 'Communication', 'Confidence', 'Personality', 'Critical Thinking', 'Workplace Readiness', 'Future Readiness'].map((t) => `<li class="marquee__item">${h(t)}</li>`).join('')}</ul>`).join('')}
  </div>
</div>

<section class="cine-split" id="journey" aria-labelledby="journey-title">
  <div class="cine-split__media">${photo(img.journey2, { sizes: '50vw' })}</div>
  <div class="cine-split__text">
    <p class="tiny-label">The Rockford journey</p>
    <h2 class="big-title" id="journey-title" data-split>${h(s.home_journey_statement)}</h2>
    <ol class="steps-list">${STEPS.map(([t, d], i) => `<li class="reveal" style="--d:${i * 0.08}s"><b>0${i + 1}</b><div><h3>${t}</h3><p>${d}</p></div></li>`).join('')}</ol>
    <a class="pill-btn pill-btn--outline-gold" href="/our-approach">See our approach →</a>
  </div>
</section>

<section class="cine-gallery surface-light" aria-labelledby="env-title">
  <div class="wrap">
    <div class="head-split"><h2 class="big-title reveal" id="env-title">Our <em>environment</em></h2><p class="caps-sub reveal">Classrooms, collaborative spaces and presentation areas designed for participation and practice.</p></div>
    <ul class="gal">${gallery.map((g, i) => `<li class="reveal" style="--d:${i * 0.08}s">${photo(g, { caption: g.label })}</li>`).join('')}</ul>
  </div>
</section>

<section class="figures paper" aria-label="Rockford at a glance">
  <div class="wrap figures__row">
    <div class="figure"><p class="figure__big"><span>06</span> Development areas</p><p class="figure__small">Communication, confidence, personality, critical thinking, workplace and future readiness.</p></div>
    <div class="figure"><p class="figure__big"><span>04</span> Journey stages</p><p class="figure__small">Discover, develop, practise and transform.</p></div>
    <div class="figure"><p class="figure__big"><span>01</span> Promise</p><p class="figure__small">${h(s.tagline)}</p></div>
  </div>
</section>

<section class="cine-band" id="difference" aria-labelledby="difference-title">
  <div class="cine-band__media">${photo(img.difference, { sizes: '100vw', cls: 'parallax' })}</div>
  <div class="wrap cine-band__inner">
    <p class="tiny-label">The Rockford difference</p>
    <h2 class="cine-title cine-title--md" id="difference-title" data-split>${h(s.home_difference_statement)}</h2>
    <p class="caps-sub reveal">${h(s.home_difference_sub)}</p>
  </div>
</section>
<section class="cine-cards cine-cards--tight paper" style="padding-top:clamp(60px,6vw,90px)" aria-label="How Rockford teaches">
  <div class="wrap"><ol class="d-cards">${PRINCIPLES.map(([t, d], i) => `<li class="d-card reveal" style="--d:${(i % 3) * 0.08}s"><span class="d-card__num">0${i + 1}</span><h3>${h(t)}</h3><p>${h(d)}</p></li>`).join('')}</ol></div>
</section>

<section class="section-pad surface-light" id="programmes" aria-labelledby="programmes-title">
  <div class="wrap">
    <div class="head-split">
      <div><p class="tiny-label">Programmes</p><h2 class="big-title reveal" id="programmes-title" style="margin-top:20px">${h(s.home_programmes_title)}</h2></div>
      <p class="caps-sub reveal">${h(s.home_programmes_intro)}</p>
    </div>
    ${programmesBlock}
  </div>
</section>

${stories}

<section class="cine-split cine-split--rev" id="careers" aria-labelledby="careers-title">
  <div class="cine-split__media">${photo(img.careers, { sizes: '50vw' })}</div>
  <div class="cine-split__text">
    <p class="tiny-label">Careers · Join our team</p>
    <h2 class="big-title" id="careers-title" data-split>${h(s.home_careers_title)}</h2>
    <p class="muted reveal">${h(s.home_careers_lede)}</p>
    <ul class="vlist">${vacancyBlock}</ul>
    <a class="pill-btn pill-btn--gold" href="/careers" data-track="cta_explore_careers">Explore career opportunities →</a>
  </div>
</section>

${news}

<section class="cine-final" aria-labelledby="final-title">
  <div class="cine-final__media">${photo(img.hero, { sizes: '100vw', cls: 'parallax' })}</div>
  <div class="wrap">
    <p class="tiny-label">Beyond tomorrow</p>
    <h2 class="cine-title" id="final-title" data-split>${h(s.home_final_title)}</h2>
    <p class="lead reveal">${h(s.home_final_text)}</p>
    <div class="actions reveal">
      <a class="pill-btn pill-btn--gold" href="/contact" data-track="cta_get_in_touch">Get in touch →</a>
      <a class="pill-btn pill-btn--outline-light" href="/careers" data-track="cta_join_team">Join our team</a>
      ${s.contact_whatsapp ? `<a class="pill-btn pill-btn--outline-light" href="https://wa.me/${h(s.contact_whatsapp)}" rel="noopener" target="_blank" data-track="whatsapp_click">WhatsApp us</a>` : ''}
    </div>
    ${contactStrip(s)}
  </div>
</section>`;
}

module.exports = { home, DIMENSIONS, PRINCIPLES };
