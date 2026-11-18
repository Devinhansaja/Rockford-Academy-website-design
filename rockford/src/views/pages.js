'use strict';
/* Inner pages. Each function returns the <main> markup; routes wrap it with layout.page(). */
const config = require('../config');
const { h, safeUrl } = require('../security');
const md = require('../markdown');
const { pageHero } = require('./layout');
const { photo, pill, programmeCard, vacancyCard, flyerCard, articleCard, formatDate, field, antiSpam, errorSummary, AVAILABILITY } = require('./components');
const { DIMENSIONS, PRINCIPLES } = require('./home');

const listItems = (arr) => (arr || []).filter(Boolean).map((x) => `<li>${h(x)}</li>`).join('');
const parseList = (json) => { try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };

function ctaBand(s, title = 'Your tomorrow starts today.', text = "Discover what's possible when confidence meets opportunity.") {
  return `<section class="final final--compact"><div class="wrap lead-row">
    <p class="tiny-label tiny-label--light">Next step</p>
    <div><h2 class="statement" data-split>${h(title)}</h2><p class="lead-row__text reveal">${h(text)}</p>
      <div class="final__actions reveal"><a class="pill-btn pill-btn--gold" href="/contact" data-track="cta_get_in_touch">Get in touch ↗</a><a class="pill-btn pill-btn--outline-light" href="/programmes">Explore programmes</a></div></div>
  </div></section>`;
}

const filters = (items, targetId, label) => {
  const cats = [...new Set(items.map((i) => i.category).filter(Boolean))];
  if (cats.length < 2) return '';
  return `<div class="slash-tabs" role="group" aria-label="${h(label)}" data-filter-group="${targetId}">
    <button type="button" aria-pressed="true" data-filter="*">/All</button>
    ${cats.map((c) => `<button type="button" aria-pressed="false" data-filter="${h(c)}">/${h(c)}</button>`).join('')}
  </div>`;
};

/* ── About ───────────────────────────────────────────────── */
function about(ctx) {
  const s = ctx.settings; const img = s.images || {};
  return `${pageHero({ label: 'About Rockford', title: 'Preparing people for opportunity.', intro: 'Rockford is an education and personal development initiative established to prepare young people in Sri Lanka to recognise, pursue and make the most of the opportunities available to them.', photoHtml: photo(img.about, { sizes: '100vw' }) })}

<section class="section-pad"><div class="wrap two-col">
  <p class="tiny-label">Why Rockford exists</p>
  <div class="prose prose--lead">
    <p class="reveal">Academic qualifications alone are not sufficient to succeed in today's competitive and rapidly evolving world. Communication, confidence, critical thinking, interpersonal skills and digital awareness matter just as much.</p>
    <p class="reveal">Rockford brings these together in one development experience, so that young people leave not only better at English, but more confident, capable and ready for what comes next.</p>
  </div>
</div></section>

<section class="section-pad surface-light"><div class="wrap">
  <div class="vm-grid">
    <article class="vm-card reveal"><span class="pill pill--outline">/Vision</span><p class="vm-card__text">To empower a generation of confident, capable and opportunity-ready individuals.</p></article>
    <article class="vm-card vm-card--navy reveal"><span class="pill">/Mission</span><p class="vm-card__text">To equip young people with the communication, personal and professional skills necessary to succeed in education, employment and life.</p></article>
  </div>
  <p class="promise reveal">Our promise: helping people become more confident, capable and ready for opportunities.</p>
</div></section>

<section class="section-pad"><div class="wrap two-col">
  <p class="tiny-label">Who we serve</p>
  <div>
    <h2 class="big-title reveal">Starting with young people, growing with Sri Lanka</h2>
    <div class="aud-grid">
      <article class="aud-card reveal"><span class="pill pill--outline">/Now</span><h3>Our initial focus</h3>
        <ul><li>School leavers</li><li>Young adults preparing for higher education</li><li>Young people entering employment</li><li>Aspiring entrepreneurs and those preparing for independent life</li></ul></article>
      <article class="aud-card aud-card--future reveal"><span class="pill pill--outline">/Next</span><h3>As Rockford grows</h3>
        <ul><li>Adults improving conversational English and confidence</li><li>Working professionals strengthening communication and interpersonal skills</li><li>Corporate teams seeking communication and professional development training</li></ul></article>
    </div>
  </div>
</div></section>

<section class="section-pad"><div class="wrap two-col">
  <p class="tiny-label">Educational philosophy</p>
  <div>
    <h2 class="big-title reveal">English is the starting point, not the finish line</h2>
    <div class="prose reveal">
      <p>Rockford is not a spoken-English institute, a grammar tuition centre or a personality-development class. English is a core tool within a broader development experience that builds communication capability, personal growth and readiness for the modern world.</p>
      <p>Learning happens through practice, participation and reflection, in an environment where every learner is expected to speak, contribute and lead.</p>
    </div>
  </div>
</div></section>

<section class="develop"><div class="wrap">
  <h2 class="big-title reveal">Our youth-development approach</h2>
  <p class="caps-sub reveal">Six connected development areas, explored through a four-stage journey.</p>
  <ol class="o-grid">${DIMENSIONS.map(([, t, d], i) => `<li class="o-card o-card--static reveal"><h3 class="o-card__title">${h(t)}</h3><p class="o-card__text">${h(d)}</p><span class="o-card__pill">/0${i + 1}</span></li>`).join('')}</ol>
</div></section>

<section class="section-pad"><div class="wrap two-col">
  <p class="tiny-label">What makes Rockford different</p>
  <ol class="principles principles--light">${PRINCIPLES.map(([t, d], i) => `<li class="reveal"><span>/0${i + 1}</span><h3>${h(t)}</h3><p>${h(d)}</p></li>`).join('')}</ol>
</div></section>
${ctaBand(s)}`;
}

/* ── Our approach ────────────────────────────────────────── */
const SCENARIOS = [
  ['Learning by doing', 'Skills are built by using them: speaking, presenting, negotiating and solving problems, not by memorising rules.', 'Learners plan and run a short event together, from the invitation email to the welcome speech.'],
  ['Group discussions', 'Structured discussions build listening, turn-taking and the confidence to share an opinion.', 'A facilitated debate on a real issue young people care about, with roles that rotate.'],
  ['Public speaking', 'Short, regular speaking moments in a supportive room make speaking up feel normal.', 'A two-minute talk about a personal goal, followed by kind, specific feedback.'],
  ['Presentations', 'Learners research, structure and deliver ideas clearly, with and without slides.', 'Teams present a solution to a local challenge to a panel.'],
  ['Collaborative problem-solving', 'Working in teams develops critical thinking, negotiation and leadership.', 'A timed case challenge where each team must agree a plan and justify it.'],
  ['Professional communication', 'Emails, interviews, phone calls and meetings practised in realistic situations.', 'A mock job interview with preparation, practice and reflection.'],
  ['Personal development activities', 'Reflection, goal-setting and feedback help learners understand their strengths and growth areas.', 'A personal development plan reviewed at each stage of the journey.'],
];
function approach(ctx) {
  const s = ctx.settings; const img = s.images || {};
  return `${pageHero({ label: 'Our approach', title: 'Real skills. Real experiences. Real growth.', intro: 'Confidence comes from practice and participation. Every Rockford experience is designed so that learners do, try, reflect and improve.', photoHtml: photo(img.approach, { sizes: '100vw' }) })}

<section class="section-pad"><div class="wrap">
  <div class="head-split"><h2 class="big-title reveal">How learning happens</h2><p class="caps-sub reveal">Examples show the kind of activity each method uses. Exact activities are confirmed per programme.</p></div>
  <ol class="scenario-list">${SCENARIOS.map(([t, d, ex], i) => `<li class="scenario reveal">
    <span class="scenario__num">/0${i + 1}</span>
    <div><h3 class="scenario__title">${h(t)}</h3><p>${h(d)}</p></div>
    <p class="scenario__example"><span class="pill pill--outline">Example</span> ${h(ex)}</p>
  </li>`).join('')}</ol>
</div></section>

<section class="journey-wrap"><div class="blue-panel">
  <div class="lead-row"><p class="tiny-label tiny-label--light">The Rockford journey</p><h2 class="statement" data-split>Discover. Develop. Practise. Transform.</h2></div>
  <div class="steps4">${[['Discover', 'Discover your potential.'], ['Develop', 'Develop essential capabilities.'], ['Practise', 'Practise through real-world experiences.'], ['Transform', 'Transform the way you approach opportunities.']].map(([t, d], i) => `<article class="alt-card reveal"><span class="pill${i === 3 ? ' pill--gold' : ''}">Step 0${i + 1}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div>
</div></section>
${ctaBand(s, 'Ready to build real skills?', 'Find a programme or talk to us about what you want to achieve.')}`;
}

/* ── Programmes ──────────────────────────────────────────── */
function programmes(ctx, { list }) {
  const s = ctx.settings; const img = s.images || {};
  const showFilters = list.length >= (s.programme_filter_threshold || 4);
  const body = list.length
    ? `${showFilters ? filters(list, 'programme-list', 'Filter programmes') : ''}<div class="pub-grid" id="programme-list">${list.map(programmeCard).join('')}</div>`
    : `<div class="pub-grid">
        <article class="pub-card"><div class="pub-card__media">${photo(img.programmes)}</div><span class="pill pill--outline">/Coming soon</span>
          <h2 class="pub-card__title">Our first programmes are being designed now</h2><p class="pub-card__text">Programme details will be published here once they are confirmed.</p></article>
        <article class="pub-card pub-card--cta"><h2 class="pub-card__title">Be the first to know when enrolment opens</h2><p class="pub-card__text">Leave your details and we will contact you as soon as programmes are announced.</p>
          <a class="pill-btn pill-btn--navy" href="/contact?topic=programmes" data-track="programme_interest">Register your interest ↗</a></article>
      </div>`;
  return `${pageHero({ label: 'Programmes', title: s.home_programmes_title, intro: s.home_programmes_intro })}
<section class="section-pad"><div class="wrap">${body}</div></section>
<section class="develop"><div class="wrap">
  <h2 class="big-title reveal">What every programme develops</h2>
  <p class="caps-sub reveal">These are development areas woven through Rockford programmes, not separate courses.</p>
  <ol class="o-grid">${DIMENSIONS.map(([, t, d]) => `<li class="o-card o-card--static reveal"><h3 class="o-card__title">${h(t)}</h3><p class="o-card__text">${h(d)}</p></li>`).join('')}</ol>
</div></section>
${ctaBand(s)}`;
}

function enquiryForm(ctx, { values = {}, errors = {}, programmes = [], fixedProgramme = null, from = 'contact' }) {
  const topic = values.topic || ctx.query.topic || (fixedProgramme ? 'programmes' : 'general');
  const topics = [['general', 'General enquiry'], ['programmes', 'Programmes and enrolment'], ['careers', 'Careers and working with us'], ['partnerships', 'Partnerships and organisations']];
  return `<form class="form" method="post" action="/enquire" novalidate data-submit-once>
    ${errorSummary(errors)}
    ${antiSpam()}
    <input type="hidden" name="from" value="${h(from)}">
    ${fixedProgramme ? `<input type="hidden" name="programme_id" value="${h(fixedProgramme.id)}"><input type="hidden" name="topic" value="programmes">` : `
    <div class="field"><label for="f-topic">What is your enquiry about?</label>
      <select id="f-topic" name="topic">${topics.map(([v, l]) => `<option value="${v}"${topic === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    ${programmes.length ? `<div class="field"><label for="f-programme_id">Programme <span class="opt">(optional)</span></label>
      <select id="f-programme_id" name="programme_id"><option value="">Not sure yet</option>${programmes.map((p) => `<option value="${p.id}"${String(values.programme_id) === String(p.id) ? ' selected' : ''}>${h(p.title)}</option>`).join('')}</select></div>` : ''}`}
    <div class="form-row">
      ${field({ name: 'name', label: 'Full name', value: values.name, error: errors.name, required: true, autocomplete: 'name' })}
      ${field({ name: 'email', label: 'Email address', type: 'email', value: values.email, error: errors.email, required: true, autocomplete: 'email' })}
    </div>
    ${field({ name: 'phone', label: 'Telephone', type: 'tel', value: values.phone, error: errors.phone, autocomplete: 'tel' })}
    ${field({ name: 'message', label: 'Your message', type: 'textarea', value: values.message, error: errors.message, required: true, attrs: 'maxlength="3000"' })}
    <div class="field field--check${errors.consent ? ' field--error' : ''}">
      <input type="checkbox" id="f-consent" name="consent" value="1"${values.consent ? ' checked' : ''}${errors.consent ? ' aria-invalid="true" aria-describedby="f-consent-err"' : ''} required>
      <label for="f-consent">I agree that Rockford Academy may use these details to respond to my enquiry, as described in the <a href="/privacy-policy" target="_blank">privacy policy</a>.</label>
      ${errors.consent ? `<p class="field__error" id="f-consent-err">${h(errors.consent)}</p>` : ''}
    </div>
    <button class="pill-btn pill-btn--navy" type="submit">Send enquiry ↗</button>
  </form>`;
}

function programme(ctx, { p, form }) {
  const objectives = parseList(p.objectives);
  const details = [['Who it is for', p.audience], ['Age group', p.age_group], ['Duration', p.duration], ['Format', p.format], ['Availability', AVAILABILITY[p.availability]]].filter((d) => d[1]);
  return `<section class="page-hero"><div class="wrap lead-row">
    <p class="tiny-label tiny-label--light"><a href="/programmes">Programmes</a>${p.category ? ' / ' + h(p.category) : ''}</p>
    <div><h1 class="statement statement--xl" data-split>${h(p.title)}</h1>${p.excerpt ? `<p class="lead-row__text reveal">${h(p.excerpt)}</p>` : ''}
      <p class="chips-row reveal"><span class="chip chip--${h(p.availability)} chip--light">${h(AVAILABILITY[p.availability])}</span></p></div>
  </div>${p.image_url ? `<div class="page-hero__photo wrap">${photo({ src: p.image_url, alt: p.image_alt }, { sizes: '100vw', eager: true })}</div>` : ''}</section>
<section class="section-pad"><div class="wrap detail-grid">
  <div class="prose">
    ${md.render(p.body)}
    ${objectives.length ? `<h2>What you will learn</h2><ul class="tick-list">${listItems(objectives)}</ul>` : ''}
    ${p.entry_requirements ? `<h2>Entry requirements</h2>${md.render(p.entry_requirements)}` : ''}
    ${p.schedule ? `<h2>Schedule</h2>${md.render(p.schedule)}` : ''}
  </div>
  <aside class="detail-aside">
    ${details.length ? `<dl class="facts">${details.map(([k, v]) => `<div><dt>${h(k)}</dt><dd>${h(v)}</dd></div>`).join('')}</dl>` : ''}
    <a class="pill-btn pill-btn--navy" href="#enquire" data-track="programme_interest" data-track-item="${h(p.slug)}">Enquire about this programme</a>
  </aside>
</div></section>
<section class="section-pad surface-light" id="enquire"><div class="wrap two-col">
  <div><p class="tiny-label">Enquire</p><h2 class="big-title">Ask about ${h(p.title)}</h2><p class="caps-sub">We will reply using the details you provide.</p></div>
  ${enquiryForm(ctx, { ...form, fixedProgramme: p, from: 'programme:' + p.slug })}
</div></section>`;
}

/* ── Careers ─────────────────────────────────────────────── */
function applicationFields(ctx, { values = {}, errors = {} }) {
  return `${errorSummary(errors)}
    ${antiSpam()}
    <div class="form-row">
      ${field({ name: 'name', label: 'Full name', value: values.name, error: errors.name, required: true, autocomplete: 'name' })}
      ${field({ name: 'email', label: 'Email address', type: 'email', value: values.email, error: errors.email, required: true, autocomplete: 'email' })}
    </div>
    ${field({ name: 'phone', label: 'Telephone number', type: 'tel', value: values.phone, error: errors.phone, required: true, autocomplete: 'tel' })}
    ${field({ name: 'qualifications', label: 'Relevant qualifications', type: 'textarea', value: values.qualifications, error: errors.qualifications, required: true, attrs: 'maxlength="3000"' })}
    ${field({ name: 'experience', label: 'Work experience', type: 'textarea', value: values.experience, error: errors.experience, required: true, attrs: 'maxlength="4000"' })}
    ${field({ name: 'message', label: 'Cover message', type: 'textarea', value: values.message, error: errors.message, hint: 'Tell us why you would like to join Rockford.', attrs: 'maxlength="4000"' })}
    <div class="field${errors.cv ? ' field--error' : ''}">
      <label for="f-cv">CV <span class="req" aria-hidden="true">*</span></label>
      <p class="field__hint" id="f-cv-hint">PDF or Word (.docx), up to ${Math.round(config.cvMaxBytes / 1048576)} MB. If the form shows an error, please attach your CV again.</p>
      <input type="file" id="f-cv" name="cv" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required aria-required="true" aria-describedby="f-cv-hint${errors.cv ? ' f-cv-err' : ''}" data-max-bytes="${config.cvMaxBytes}"${errors.cv ? ' aria-invalid="true"' : ''}>
      ${errors.cv ? `<p class="field__error" id="f-cv-err">${h(errors.cv)}</p>` : ''}
    </div>
    <div class="field field--check${errors.consent ? ' field--error' : ''}">
      <input type="checkbox" id="f-consent" name="consent" value="1"${values.consent ? ' checked' : ''} required${errors.consent ? ' aria-invalid="true" aria-describedby="f-consent-err"' : ''}>
      <label for="f-consent">I confirm the information is accurate and agree that Rockford Academy may store and use my application and CV to assess it, as described in the <a href="/privacy-policy" target="_blank">privacy policy</a>. My application will be deleted automatically after ${h(ctx.settings.retention_applications_days)} days.</label>
      ${errors.consent ? `<p class="field__error" id="f-consent-err">${h(errors.consent)}</p>` : ''}
    </div>`;
}

function careers(ctx, { vacancies, flyers = [], form }) {
  const s = ctx.settings; const img = s.images || {};
  return `${pageHero({ label: 'Careers · Join our team', title: s.home_careers_title, intro: s.home_careers_lede, photoHtml: photo(img.careers, { sizes: '100vw' }) })}

<section class="section-pad" id="why"><div class="wrap two-col">
  <p class="tiny-label">Why Rockford</p>
  <div>
    <h2 class="big-title reveal">Purposeful work with young people</h2>
    <div class="prose reveal">
      <p>Rockford exists to empower a generation of confident, capable and opportunity-ready individuals. Our team helps young people build the communication, personal and professional skills to succeed in education, employment and life.</p>
      <p>We are building a practical, participative learning environment, where discussion, presentation, collaboration and reflection matter more than lectures. If you enjoy helping people find their voice, we would like to hear from you.</p>
    </div>
  </div>
</div></section>

<section class="careers surface-light" id="vacancies"><svg class="fan fan--corner" viewBox="0 0 240 240" aria-hidden="true" data-fan></svg>
  <div class="wrap">
    <div class="head-split"><h2 class="big-title reveal">Open positions</h2><p class="caps-sub reveal">${vacancies.length ? 'Select a role to read the full description and apply online.' : 'There are no open positions right now. New roles are published here first.'}</p></div>
    ${vacancies.length ? filters(vacancies, 'vacancy-list', 'Filter vacancies') : ''}
    <ul class="vacancies" id="vacancy-list">${vacancies.length ? vacancies.map(vacancyCard).join('') : `<li class="ev-card ev-card--empty"><div class="ev-card__top"><span class="ev-card__date">Open positions</span><span class="pill pill--outline">/Coming soon</span></div><h3 class="ev-card__title">New roles will be announced soon</h3><p class="ev-card__text">Please check back shortly.</p></li>`}</ul>
  </div>
</section>

${flyers.length ? `<section class="section-pad" id="flyers"><div class="wrap">
    <div class="head-split"><h2 class="big-title reveal">Job flyers</h2><p class="caps-sub reveal">Current job announcements. Open a flyer to read the full details.</p></div>
    <ul class="flyers">${flyers.map(flyerCard).join('')}</ul>
  </div></section>

` : ''}<section class="section-pad" id="apply"><div class="wrap two-col">
  <p class="tiny-label">How to apply</p>
  <ol class="apply-steps">
    <li class="reveal"><span>/01</span><div><h3>Choose a role</h3><p>Read the description, responsibilities and requirements carefully.</p></div></li>
    <li class="reveal"><span>/02</span><div><h3>Apply online</h3><p>Complete the application form and attach your CV as a PDF or Word document.</p></div></li>
    <li class="reveal"><span>/03</span><div><h3>Get your reference</h3><p>You will see an application reference straight away. Keep it for any questions.</p></div></li>
    <li class="reveal"><span>/04</span><div><h3>Hear from us</h3><p>Our recruitment team reviews every application and contacts shortlisted candidates.</p></div></li>
  </ol>
</div></section>

${s.eoi_enabled ? `<section class="section-pad surface-light" id="interest"><div class="wrap two-col">
  <div><p class="tiny-label">Expression of interest</p><h2 class="big-title">Don't see the right role?</h2><p class="caps-sub">Share your details and CV and we will contact you if a suitable role opens.</p></div>
  <form class="form" method="post" action="/careers/interest" enctype="multipart/form-data" novalidate data-submit-once>
    ${applicationFields(ctx, form || {})}
    <button class="pill-btn pill-btn--navy" type="submit">Send expression of interest ↗</button>
  </form>
</div></section>` : ''}`;
}

function vacancy(ctx, { v, form, open }) {
  const resp = parseList(v.responsibilities); const quals = parseList(v.qualifications);
  const facts = [['Employment type', v.employment_type], ['Location', v.location], ['Category', v.category], ['Closing date', formatDate(v.deadline)]].filter((d) => d[1]);
  return `<section class="page-hero"><div class="wrap lead-row">
    <p class="tiny-label tiny-label--light"><a href="/careers">Careers</a> / Vacancy</p>
    <div><h1 class="statement statement--xl" data-split>${h(v.title)}</h1>${v.summary ? `<p class="lead-row__text reveal">${h(v.summary)}</p>` : ''}
      ${open ? '' : '<p class="chips-row"><span class="chip chip--closed chip--light">Applications closed</span></p>'}</div>
  </div></section>
<section class="section-pad"><div class="wrap detail-grid">
  <div class="prose">
    ${md.render(v.description)}
    ${resp.length ? `<h2>Responsibilities</h2><ul class="tick-list">${listItems(resp)}</ul>` : ''}
    ${quals.length ? `<h2>Required qualifications</h2><ul class="tick-list">${listItems(quals)}</ul>` : ''}
  </div>
  <aside class="detail-aside">
    ${facts.length ? `<dl class="facts">${facts.map(([k, val]) => `<div><dt>${h(k)}</dt><dd>${h(val)}</dd></div>`).join('')}</dl>` : ''}
    ${open ? '<a class="pill-btn pill-btn--navy" href="#apply">Apply for this role</a>' : '<p>This vacancy is no longer accepting applications.</p><a class="pill-btn pill-btn--navy" href="/careers">See open positions</a>'}
  </aside>
</div></section>
${open ? `<section class="section-pad surface-light" id="apply"><div class="wrap two-col">
  <div><p class="tiny-label">Application form</p><h2 class="big-title">Apply for ${h(v.title)}</h2><p class="caps-sub">All fields marked * are required. Your CV is stored securely and is only seen by the recruitment team.</p></div>
  <form class="form" method="post" action="/careers/${h(v.slug)}/apply" enctype="multipart/form-data" novalidate data-submit-once>
    ${applicationFields(ctx, form || {})}
    <button class="pill-btn pill-btn--navy" type="submit">Submit application ↗</button>
  </form>
</div></section>` : ''}`;
}

/* ── Contact ─────────────────────────────────────────────── */
function contact(ctx, { programmes, form }) {
  const s = ctx.settings;
  const rows = [];
  if (s.contact_address) rows.push(['Visit us', h(s.contact_address).replace(/\n/g, '<br>')]);
  if (s.contact_phone) rows.push(['Call', `<a href="tel:${h(s.contact_phone.replace(/[^\d+]/g, ''))}">${h(s.contact_phone)}</a>`]);
  if (s.contact_whatsapp) rows.push(['WhatsApp', `<a href="https://wa.me/${h(s.contact_whatsapp)}" rel="noopener" target="_blank" data-track="whatsapp_click">Message us on WhatsApp</a>`]);
  if (s.contact_email) rows.push(['General enquiries', `<a href="mailto:${h(s.contact_email)}">${h(s.contact_email)}</a>`]);
  if (s.admissions_email) rows.push(['Admissions', `<a href="mailto:${h(s.admissions_email)}">${h(s.admissions_email)}</a>`]);
  if (s.careers_email) rows.push(['Careers', `<a href="mailto:${h(s.careers_email)}">${h(s.careers_email)}</a>`]);
  if (s.opening_hours) rows.push(['Opening hours', h(s.opening_hours).replace(/\n/g, '<br>')]);
  const social = (s.social || []).filter((x) => /^https:/.test(x.url || ''));
  const map = /^https:\/\/www\.google\.com\/maps\/embed\?/.test(s.map_embed_url || '') ? s.map_embed_url : '';
  return `${pageHero({ label: 'Contact', title: "Let's talk about what's next.", intro: 'Ask about programmes, careers or partnerships. We read every message.' })}
<section class="section-pad"><div class="wrap contact-grid">
  <div class="contact-info">
    ${rows.length ? `<dl class="facts facts--contact">${rows.map(([k, v]) => `<div><dt>${h(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>` : '<p class="caps-sub">Our official contact details will be published here shortly. In the meantime, please use the form.</p>'}
    ${social.length ? `<ul class="social social--dark">${social.map((x) => `<li><a class="pill-btn pill-btn--sm pill-btn--outline" href="${h(x.url)}" rel="noopener" target="_blank">${h(x.label)}</a></li>`).join('')}</ul>` : ''}
    ${map ? `<div class="map"><iframe src="${h(map)}" title="Map showing the Rockford Academy location" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : ''}
  </div>
  <div><h2 class="big-title big-title--sm">Send us a message</h2>${enquiryForm(ctx, { ...form, programmes, from: 'contact' })}</div>
</div></section>`;
}

/* ── News ────────────────────────────────────────────────── */
function news(ctx, { list }) {
  return `${pageHero({ label: 'News & insights', title: 'Ideas, updates and stories.', intro: 'News from Rockford Academy and practical insight on communication, confidence and opportunity.' })}
<section class="section-pad"><div class="wrap">
  ${list.length ? `${filters(list, 'article-list', 'Filter articles')}<div class="pub-grid pub-grid--3" id="article-list">${list.map(articleCard).join('')}</div>` : '<p class="caps-sub">The first articles are being written. Please check back soon.</p>'}
</div></section>`;
}

function article(ctx, { a, more }) {
  return `<article>
<section class="page-hero"><div class="wrap lead-row">
  <p class="tiny-label tiny-label--light"><a href="/news">News</a>${a.category ? ' / ' + h(a.category) : ''}</p>
  <div><h1 class="statement statement--xl" data-split>${h(a.title)}</h1><p class="lead-row__text"><time datetime="${new Date(a.published_at || a.created_at).toISOString()}">${h(formatDate(a.published_at || a.created_at))}</time></p></div>
</div>${a.image_url ? `<div class="page-hero__photo wrap">${photo({ src: a.image_url, alt: a.image_alt }, { sizes: '100vw', eager: true })}</div>` : ''}</section>
<section class="section-pad"><div class="wrap"><div class="prose prose--article">${md.render(a.body)}</div></div></section>
</article>
${more.length ? `<section class="section-pad surface-light"><div class="wrap"><h2 class="big-title big-title--sm">More news</h2><div class="pub-grid pub-grid--3">${more.map(articleCard).join('')}</div></div></section>` : ''}`;
}

/* ── Legal / utility ─────────────────────────────────────── */
function legal(ctx, { title, body }) {
  return `${pageHero({ label: 'Legal', title })}
<section class="section-pad"><div class="wrap"><div class="prose prose--article">${md.render(body)}</div></div></section>`;
}

function thanks(ctx, { kind, ref, delivered }) {
  const isApp = kind === 'application';
  const event = isApp ? 'job_application_submitted' : 'generate_lead';
  return `${pageHero({ label: isApp ? 'Application received' : 'Message received', title: isApp ? 'Thank you for applying.' : 'Thank you for getting in touch.' })}
<section class="section-pad" data-analytics-event="${event}" data-analytics-params='${h(JSON.stringify({ form_type: kind || 'enquiry' }))}'><div class="wrap narrow">
  ${ref ? `<p class="ref-box">Your reference: <strong>${h(ref)}</strong></p>` : ''}
  <div class="prose">
    <p>${isApp ? 'Your application has been received and stored securely. Our recruitment team reviews every application and will contact shortlisted candidates.' : 'Your message has been received. We will reply as soon as possible using the details you provided.'}</p>
    ${delivered ? '<p>A confirmation has also been sent to your email address.</p>' : '<p>Please keep your reference for any follow-up.</p>'}
  </div>
  <p class="final__actions"><a class="pill-btn pill-btn--navy" href="/">Back to the homepage</a><a class="pill-btn pill-btn--outline" href="${isApp ? '/careers' : '/programmes'}">${isApp ? 'See other roles' : 'Explore programmes'}</a></p>
</div></section>`;
}

function notFound() {
  return `<section class="page-hero page-hero--tall"><div class="wrap lead-row">
  <p class="tiny-label tiny-label--light">Error 404</p>
  <div><h1 class="statement statement--xl">This page has moved beyond tomorrow.</h1>
  <p class="lead-row__text">We couldn't find the page you were looking for. It may have been moved, or the address may be mistyped.</p>
  <div class="final__actions"><a class="pill-btn pill-btn--gold" href="/">Go to the homepage</a><a class="pill-btn pill-btn--outline-light" href="/programmes">Programmes</a><a class="pill-btn pill-btn--outline-light" href="/contact">Contact us</a></div></div>
</div></section>`;
}

function serverError() {
  return `<section class="page-hero page-hero--tall"><div class="wrap lead-row"><p class="tiny-label tiny-label--light">Error 500</p>
  <div><h1 class="statement statement--xl">Something went wrong.</h1><p class="lead-row__text">Please try again in a moment. If the problem continues, contact us.</p>
  <div class="final__actions"><a class="pill-btn pill-btn--gold" href="/">Go to the homepage</a></div></div></div></section>`;
}

module.exports = { about, approach, programmes, programme, careers, vacancy, contact, news, article, legal, thanks, notFound, serverError, enquiryForm, parseList };
