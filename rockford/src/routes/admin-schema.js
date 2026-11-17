'use strict';
/*
 * Admin form definitions and validation: programmes, vacancies, articles, testimonials
 * (generic CRUD) and the Website Settings sections. Used by src/routes/admin.js.
 *
 * Field spec: { name, label, type, required, maxlength, options, hint, image, min, max, toDb, fromDb }
 * Form values are always strings; toDb()/fromDb() convert to and from database values.
 */
const { h, safeUrl } = require('../security');
const { q, now } = require('../db');
const settings = require('../settings');
const mail = require('../mail');
const ui = require('../views/admin/ui');

const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
const SLUG_RE = /^[a-z0-9-]+$/;

/* ── Generic helpers ─────────────────────────────────────────── */
const str = (v) => (typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '').replace(/\r\n?/g, '\n').trim();
const splitLines = (v) => String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
const parseJsonArr = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };
const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z')) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;

/** Problem with an image URL shown on the website ('' if fine). The site's CSP only allows these hosts. */
function imageUrlProblem(u) {
  if (!u) return '';
  if (/[\s"'<>\\]/.test(u)) return 'The image URL must not contain spaces or quotes.';
  const s = safeUrl(u);
  if (!s || /^(mailto|tel):/i.test(s)) return 'Enter an image URL starting with /uploads/ (from the Media Library) or https://.';
  if (/^http:/i.test(s)) return 'Use a secure https:// image link.';
  if (/^https:/i.test(s) && !/^https:\/\/images\.unsplash\.com\//i.test(s)) {
    return 'For security the website can only show images from the Media Library (/uploads/…) or images.unsplash.com. Upload the image in the Media Library and paste its URL here.';
  }
  return '';
}
function linkProblem(u, { httpsOnly = false } = {}) {
  if (!u) return '';
  if (/[\s"'<>\\]/.test(u)) return 'The link must not contain spaces or quotes.';
  const s = safeUrl(u);
  if (!s || /^(mailto|tel):/i.test(s) || /^http:/i.test(s)) return httpsOnly ? 'Enter a full link starting with https://.' : 'Enter a link starting with / or https://.';
  if (httpsOnly && !/^https:\/\//i.test(s)) return 'Enter a full link starting with https://.';
  return '';
}
const VIDEO_RE = /^https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[A-Za-z0-9_-]{6,20}(?:\?[A-Za-z0-9_=&;-]*)?$/;

/** Read the form fields named in `list` from the body as trimmed strings. */
function readForm(list, body) {
  const form = {};
  for (const f of list) {
    if (f.section) continue;
    const v = str(body[f.name]);
    form[f.name] = f.type === 'checkbox' ? (v ? '1' : '') : v;
  }
  return form;
}

/** Generic checks from the field specs. Adds messages to `errors`. */
function validateFields(list, form, errors) {
  for (const f of list) {
    if (f.section) continue;
    const v = form[f.name]; const L = f.label;
    if (f.required && !v) { errors[f.name] = `${L} is required.`; continue; }
    if (!v) continue;
    if (f.maxlength && v.length > f.maxlength) errors[f.name] = `${L} must be ${f.maxlength} characters or fewer (currently ${v.length}).`;
    else if (f.type === 'select' && !f.options.some(([o]) => String(o) === v)) errors[f.name] = `Choose a valid option for ${L.toLowerCase()}.`;
    else if (f.type === 'number' && (!/^-?\d{1,7}$/.test(v) || (f.min !== undefined && +v < f.min) || (f.max !== undefined && +v > f.max))) {
      errors[f.name] = f.min !== undefined && f.max !== undefined ? `${L} must be a whole number from ${f.min} to ${f.max}.` : `${L} must be a whole number.`;
    } else if (f.type === 'date' && !validDate(v)) errors[f.name] = `${L} must be a valid date (YYYY-MM-DD).`;
    else if (f.type === 'email' && !EMAIL_RE.test(v)) errors[f.name] = `Enter a valid email address for ${L.toLowerCase()}, like name@example.com.`;
    else if (f.type === 'lines' && splitLines(v).length > 50) errors[f.name] = `${L}: use 50 lines or fewer.`;
    else if (f.image) { const p = imageUrlProblem(v); if (p) errors[f.name] = p; }
  }
  return errors;
}

/* ── Content types (generic CRUD) ────────────────────────────── */
const titleField = { name: 'title', label: 'Title', required: true, maxlength: 150, attrs: 'data-slug-source' };
const slugField = { name: 'slug', label: 'URL slug', maxlength: 90, hint: 'The last part of the page address. Lowercase letters, numbers and hyphens only. Leave blank to create it from the title.', attrs: 'data-slug-target autocapitalize="off" spellcheck="false"' };
const seoFields = [
  { section: 'Search engines (optional)', note: 'Leave blank to use the title and summary automatically.' },
  { name: 'seo_title', label: 'SEO title', maxlength: 70, hint: 'Shown as the headline in Google results. Around 50–60 characters works best.' },
  { name: 'seo_description', label: 'SEO description', type: 'textarea', rows: 3, maxlength: 170, hint: 'Shown under the headline in Google results. Around 150 characters.' },
];
const imageFields = [
  { name: 'image_url', label: 'Image URL', maxlength: 500, image: true, hint: 'Paste a URL from the Media Library, e.g. /uploads/2026/11/….jpg' },
  { name: 'image_alt', label: 'Image description (alt text)', maxlength: 250, hint: 'Describe the photo for people using screen readers.' },
];
const pubDateField = { name: 'published_at', label: 'Publish date', type: 'date', hint: 'Shown on the article. Leave blank to use today when it is published.', fromDb: ui.isoDate, toDb: (v) => (v ? ui.fromIsoDate(v) : null) };
const statusOpts = (list) => list.map((s) => [s, ui.humanize(s)]);

const titleCell = (key) => (r) => `<a href="/admin/${key}/${r.id}">${h(r.title)}</a>${r.slug ? `<br><span class="muted small mono">/${h(r.slug)}</span>` : ''}`;
const updatedCol = { label: 'Updated', render: (r) => h(ui.fmtDateTime(r.updated_at)) };
const statusCol = { label: 'Status', render: (r) => ui.statusBadge(r.status) };

function slugCheck(table) {
  return (form, errors, row) => {
    if (!form.slug || errors.slug) return;
    if (!SLUG_RE.test(form.slug)) { errors.slug = 'The URL slug can only contain lowercase letters (a–z), numbers and hyphens.'; return; }
    if (q.get(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`, form.slug, row ? row.id : 0)) errors.slug = 'Another item already uses this URL slug. Choose a different one.';
  };
}
const altCheck = (form, errors) => { if (form.image_url && !form.image_alt && !errors.image_alt) errors.image_alt = 'Describe the image (alt text) so it is accessible.'; };
/** Set published_at the first time something goes live. */
const firstPublished = (liveStatus) => (data, row) => {
  const current = 'published_at' in data ? data.published_at : row ? row.published_at : null;
  if (data.status === liveStatus && !current) data.published_at = now();
};

const ENTITIES = [
  {
    key: 'programmes', table: 'programmes', area: 'content', label: 'Programmes', singular: 'Programme', slug: true,
    intro: 'Courses and programmes shown on the website. Drafts are never shown publicly.',
    defaults: { status: 'draft', availability: 'coming_soon', sort: '0', format: '' },
    fields: [
      { section: 'Basics' },
      titleField, slugField,
      { name: 'excerpt', label: 'Short summary', type: 'textarea', rows: 3, maxlength: 300, hint: 'One or two sentences shown on programme cards.' },
      { name: 'body', label: 'Full description', type: 'markdown', maxlength: 50000 },
      { section: 'Details' },
      { name: 'audience', label: 'Who it is for', maxlength: 200 },
      { name: 'age_group', label: 'Age group', maxlength: 100, placeholder: 'e.g. 16–24' },
      { name: 'duration', label: 'Duration', maxlength: 100, placeholder: 'e.g. 12 weeks' },
      { name: 'format', label: 'Format', type: 'select', options: [['', 'Not specified'], ['In person', 'In person'], ['Online', 'Online'], ['Blended', 'Blended']] },
      { name: 'category', label: 'Category', maxlength: 80 },
      { name: 'objectives', label: 'Learning objectives', type: 'lines', rows: 5, maxlength: 5000, hint: 'One objective per line.' },
      { name: 'entry_requirements', label: 'Entry requirements', type: 'textarea', maxlength: 2000 },
      { name: 'schedule', label: 'Schedule', type: 'textarea', maxlength: 2000, hint: 'Days, times and start dates, once confirmed.' },
      { section: 'Publishing' },
      { name: 'availability', label: 'Availability', type: 'select', options: [['coming_soon', 'Coming soon'], ['enrolling', 'Now enrolling'], ['waitlist', 'Waiting list'], ['closed', 'Closed']] },
      { name: 'status', label: 'Status', type: 'select', options: statusOpts(['draft', 'published']), hint: 'Only published programmes appear on the website.' },
      { name: 'sort', label: 'Sort order', type: 'number', min: -9999, max: 9999, hint: 'Lower numbers appear first.' },
      { section: 'Image' },
      ...imageFields,
      ...seoFields,
    ],
    validate: [slugCheck('programmes'), altCheck],
    listSql: 'SELECT * FROM programmes ORDER BY sort, title COLLATE NOCASE',
    listColumns: [
      { label: 'Title', render: titleCell('programmes') }, statusCol,
      { label: 'Availability', render: (r) => ui.statusBadge(r.availability) }, updatedCol,
    ],
    quick: { published: 'Publish', draft: 'Unpublish' },
  },
  {
    key: 'vacancies', table: 'vacancies', area: 'recruitment', label: 'Vacancies', singular: 'Vacancy', slug: true,
    intro: 'Job openings. Only open vacancies are shown on the Careers page and accept applications.',
    defaults: { status: 'draft', employment_type: 'Full-time' },
    fields: [
      { section: 'Basics' },
      titleField, slugField,
      { name: 'summary', label: 'Short summary', type: 'textarea', rows: 3, maxlength: 400 },
      { name: 'description', label: 'Full description', type: 'markdown', maxlength: 50000 },
      { name: 'responsibilities', label: 'Responsibilities', type: 'lines', rows: 6, maxlength: 8000, hint: 'One responsibility per line.' },
      { name: 'qualifications', label: 'Qualifications and experience', type: 'lines', rows: 6, maxlength: 8000, hint: 'One requirement per line.' },
      { section: 'Details' },
      { name: 'employment_type', label: 'Employment type', type: 'select', options: ['Full-time', 'Part-time', 'Contract', 'Visiting', 'Internship'].map((x) => [x, x]) },
      { name: 'location', label: 'Location', maxlength: 120 },
      { name: 'category', label: 'Category / department', maxlength: 80 },
      { name: 'deadline', label: 'Application deadline', type: 'date', hint: 'Optional. Leave blank for “open until filled”.' },
      { name: 'status', label: 'Status', type: 'select', options: statusOpts(['draft', 'open', 'closed', 'archived']), hint: 'Open = visible and accepting applications. Closed = visible but not accepting. Archived = hidden.' },
      ...seoFields,
    ],
    validate: [slugCheck('vacancies')],
    beforeSave: firstPublished('open'),
    listSql: `SELECT v.*, (SELECT COUNT(*) FROM applications a WHERE a.vacancy_id = v.id) AS app_count FROM vacancies v
              ORDER BY CASE v.status WHEN 'open' THEN 0 WHEN 'draft' THEN 1 WHEN 'closed' THEN 2 ELSE 3 END, v.updated_at DESC`,
    listColumns: [
      { label: 'Title', render: titleCell('vacancies') }, statusCol,
      { label: 'Type', render: (r) => h([r.employment_type, r.location].filter(Boolean).join(' · ')) },
      { label: 'Deadline', render: (r) => h(r.deadline ? ui.fmtDate(ui.fromIsoDate(r.deadline)) : '—') },
      { label: 'Applications', render: (r) => `<a href="/admin/applications?vacancy=${r.id}">${Number(r.app_count)}</a>` },
    ],
    quick: { open: 'Open', closed: 'Close', archived: 'Archive' },
    quickLabel: (from, to) => (to === 'open' ? (from === 'draft' ? 'Publish (open)' : 'Reopen') : to === 'closed' ? 'Close' : 'Archive'),
  },
  {
    key: 'articles', table: 'articles', area: 'content', label: 'News & Articles', singular: 'Article', slug: true,
    intro: 'News, stories and announcements.',
    defaults: { status: 'draft' },
    fields: [
      { section: 'Article' },
      titleField, slugField,
      { name: 'excerpt', label: 'Short summary', type: 'textarea', rows: 3, maxlength: 300 },
      { name: 'body', label: 'Article text', type: 'markdown', rows: 20, maxlength: 80000 },
      { name: 'category', label: 'Category', maxlength: 80 },
      { section: 'Image' },
      ...imageFields,
      { section: 'Publishing' },
      { name: 'status', label: 'Status', type: 'select', options: statusOpts(['draft', 'published']) },
      pubDateField,
      ...seoFields,
    ],
    validate: [slugCheck('articles'), altCheck],
    beforeSave: firstPublished('published'),
    listSql: 'SELECT * FROM articles ORDER BY COALESCE(published_at, created_at) DESC',
    listColumns: [
      { label: 'Title', render: titleCell('articles') }, statusCol,
      { label: 'Category', render: (r) => h(r.category || '—') },
      { label: 'Published', render: (r) => h(r.published_at ? ui.fmtDate(r.published_at) : '—') }, updatedCol,
    ],
    quick: { published: 'Publish', draft: 'Unpublish' },
  },
  {
    key: 'testimonials', table: 'testimonials', area: 'content', label: 'Testimonials', singular: 'Testimonial',
    intro: 'Quotes from learners, parents and partners. A testimonial can only be published once written consent is confirmed and an approver is named.',
    defaults: { status: 'draft', sort: '0' },
    fields: [
      { section: 'Testimonial' },
      { name: 'name', label: 'Person’s name', required: true, maxlength: 100 },
      { name: 'role', label: 'Role or description', maxlength: 150, placeholder: 'e.g. Parent, 2026 graduate' },
      { name: 'quote', label: 'Quote', type: 'textarea', rows: 5, required: true, maxlength: 1000 },
      { name: 'image_url', label: 'Photo URL', maxlength: 500, image: true, hint: 'Optional. Paste a URL from the Media Library.' },
      { name: 'video_url', label: 'YouTube video (embed link)', maxlength: 300, hint: 'Optional. Must start with https://www.youtube-nocookie.com/embed/ or https://www.youtube.com/embed/ (YouTube → Share → Embed).' },
      { section: 'Consent and publishing' },
      { name: 'consent_confirmed', label: 'Written consent to publish has been received', type: 'checkbox' },
      { name: 'approved_by', label: 'Approved by', maxlength: 100, hint: 'Name of the Rockford staff member who approved publication.' },
      { name: 'status', label: 'Status', type: 'select', options: statusOpts(['draft', 'published']) },
      { name: 'sort', label: 'Sort order', type: 'number', min: -9999, max: 9999, hint: 'Lower numbers appear first.' },
    ],
    validate: [(form, errors) => {
      if (form.video_url && !errors.video_url) {
        if (!VIDEO_RE.test(form.video_url)) errors.video_url = 'Use a YouTube embed link starting with https://www.youtube-nocookie.com/embed/ or https://www.youtube.com/embed/.';
        else form.video_url = form.video_url.replace('https://www.youtube.com/embed/', 'https://www.youtube-nocookie.com/embed/');
      }
    }],
    /** Server-side publishing rule. */
    publishProblem: (r) => (r.status === 'published' && !(Number(r.consent_confirmed) === 1 && String(r.approved_by || '').trim())
      ? 'A testimonial can only be published after written consent is confirmed and the approver’s name is entered.' : ''),
    listSql: 'SELECT * FROM testimonials ORDER BY sort, id',
    listColumns: [
      { label: 'Name', render: (r) => `<a href="/admin/testimonials/${r.id}">${h(r.name)}</a>${r.role ? `<br><span class="muted small">${h(r.role)}</span>` : ''}` },
      statusCol,
      { label: 'Consent', render: (r) => (r.consent_confirmed ? ui.badge('Confirmed', 'ok') : ui.badge('Not confirmed', 'warn')) },
      { label: 'Approved by', render: (r) => h(r.approved_by || '—') },
      { label: 'Sort', render: (r) => h(r.sort) },
    ],
    quick: { published: 'Publish', draft: 'Unpublish' },
  },
];

/* Convert stored rows <-> form strings <-> column values. */
function toForm(def, row) {
  const v = {};
  for (const f of def.fields) {
    if (f.section) continue;
    const d = row[f.name];
    if (f.fromDb) v[f.name] = f.fromDb(d);
    else if (f.type === 'lines') v[f.name] = parseJsonArr(d).join('\n');
    else if (f.type === 'checkbox') v[f.name] = d ? '1' : '';
    else v[f.name] = d === null || d === undefined ? '' : String(d);
  }
  return v;
}
function toDb(def, form) {
  const out = {};
  for (const f of def.fields) {
    if (f.section) continue;
    const v = form[f.name];
    if (f.toDb) out[f.name] = f.toDb(v);
    else if (f.type === 'lines') out[f.name] = JSON.stringify(splitLines(v));
    else if (f.type === 'checkbox') out[f.name] = v ? 1 : 0;
    else if (f.type === 'number') out[f.name] = v === '' ? 0 : parseInt(v, 10);
    else out[f.name] = v;
  }
  return out;
}

/* ── Website Settings sections ───────────────────────────────── */
const emailList = (v) => String(v || '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
function checkEmailList(form, errors, key, label) {
  const list = emailList(form[key]);
  const bad = list.filter((e) => !EMAIL_RE.test(e));
  if (bad.length) errors[key] = `${label}: “${bad[0]}” is not a valid email address.`;
  else if (list.length > 10) errors[key] = `${label}: enter 10 addresses or fewer.`;
  return list.join(', ');
}

const HOME_LABELS = {
  home_hero_eyebrow: 'Hero – small gold label above the headline', home_hero_line1: 'Hero headline – line 1', home_hero_line2: 'Hero headline – line 2', home_hero_sub: 'Hero introduction',
  home_about_statement: 'About – statement', home_about_text: 'About – text', home_dims_intro: 'Areas of development – introduction',
  home_journey_statement: 'Journey – statement', home_difference_statement: 'The Rockford difference – statement',
  home_difference_sub: 'The Rockford difference – supporting line', home_programmes_title: 'Programmes – heading',
  home_programmes_intro: 'Programmes – introduction', home_careers_title: 'Careers – heading', home_careers_lede: 'Careers – introduction',
  home_final_title: 'Closing call to action – heading', home_final_text: 'Closing call to action – text',
};
const HOME_KEYS = Object.keys(settings.DEFAULTS).filter((k) => k.startsWith('home_'));

const IMAGE_SLOTS = [
  ['hero', 'Homepage hero'], ['journey1', 'Journey – step 1'], ['journey2', 'Journey – step 2'], ['journey3', 'Journey – step 3'],
  ['difference', 'The Rockford difference'], ['programmes', 'Programmes section'], ['about', 'About section'],
  ['approach', 'Our approach'], ['careers', 'Careers section'],
];
const GALLERY_COUNT = 4;
const stockHint = 'Shows an “Illustrative photo” label on the website. Untick once you replace it with a real Rockford photo.';
const imgFields = (prefix) => [
  { name: `${prefix}_src`, label: 'Image URL', required: true, maxlength: 500, image: true },
  { name: `${prefix}_alt`, label: 'Alt text', required: true, maxlength: 250 },
  { name: `${prefix}_stock`, label: 'Temporary stock photo', type: 'checkbox', hint: stockHint },
];

const SECTIONS = [
  {
    key: 'brand', label: 'Brand', area: 'settings', group: 'settings',
    fields: [
      { name: 'site_name', label: 'Site name', required: true, maxlength: 80 },
      { name: 'tagline', label: 'Tagline', maxlength: 150 },
      { name: 'logo_url', label: 'Logo URL', maxlength: 500, image: true, hint: 'Leave blank to use the built-in wordmark. Upload the approved logo in the Media Library and paste its URL.' },
    ],
    load: (s) => ({ site_name: s.site_name, tagline: s.tagline, logo_url: s.logo_url }),
    parse: (f) => ({ site_name: f.site_name, tagline: f.tagline, logo_url: f.logo_url }),
  },
  {
    key: 'contact', label: 'Contact', area: 'settings', group: 'settings',
    description: 'Only enter confirmed details. Anything left blank is hidden on the website.',
    fields: [
      { name: 'contact_address', label: 'Address', type: 'textarea', rows: 3, maxlength: 400 },
      { name: 'contact_phone', label: 'Telephone', maxlength: 40, placeholder: '+94 11 234 5678' },
      { name: 'contact_whatsapp', label: 'WhatsApp number', maxlength: 20, hint: 'International format, digits only, e.g. 94771234567 (no + or leading 0).' },
      { name: 'contact_email', label: 'General email', type: 'email', maxlength: 200 },
      { name: 'admissions_email', label: 'Admissions email', type: 'email', maxlength: 200 },
      { name: 'careers_email', label: 'Careers email', type: 'email', maxlength: 200 },
      { name: 'opening_hours', label: 'Opening hours', type: 'textarea', rows: 3, maxlength: 400 },
      { name: 'map_embed_url', label: 'Google Maps embed URL', maxlength: 1500, hint: 'In Google Maps: Share → Embed a map → copy only the src="…" link. It must start with https://www.google.com/maps/embed' },
      { name: 'social', label: 'Social media links', type: 'textarea', rows: 4, maxlength: 2000, hint: 'One per line as: Label | https://link — e.g. Instagram | https://www.instagram.com/rockford' },
    ],
    load: (s) => ({
      contact_address: s.contact_address, contact_phone: s.contact_phone, contact_whatsapp: s.contact_whatsapp, contact_email: s.contact_email,
      admissions_email: s.admissions_email, careers_email: s.careers_email, opening_hours: s.opening_hours, map_embed_url: s.map_embed_url,
      social: (Array.isArray(s.social) ? s.social : []).map((x) => `${x.label} | ${x.url}`).join('\n'),
    }),
    parse: (f, errors) => {
      if (f.contact_phone && !/^[0-9+()\-.\s]{6,40}$/.test(f.contact_phone)) errors.contact_phone = 'The telephone number can only contain digits, spaces, +, -, ( and ).';
      const wa = f.contact_whatsapp.replace(/[\s()+-]/g, '');
      if (wa && !/^\d{8,15}$/.test(wa)) errors.contact_whatsapp = 'The WhatsApp number must be 8–15 digits in international format, e.g. 94771234567.';
      else if (wa.startsWith('0')) errors.contact_whatsapp = 'Start the WhatsApp number with the country code (94 for Sri Lanka), not 0.';
      if (f.map_embed_url && (!f.map_embed_url.startsWith('https://www.google.com/maps/embed') || /[\s"'<>]/.test(f.map_embed_url))) {
        errors.map_embed_url = 'Paste only the embed link from Google Maps. It must start with https://www.google.com/maps/embed';
      }
      const social = [];
      splitLines(f.social).forEach((line, i) => {
        const [label, url] = line.split('|').map((x) => (x || '').trim());
        if (!label || !url) errors.social ||= `Social links line ${i + 1}: use the format Label | https://link`;
        else if (linkProblem(url, { httpsOnly: true })) errors.social ||= `Social links line ${i + 1}: the link must start with https://`;
        else if (label.length > 40) errors.social ||= `Social links line ${i + 1}: keep the label under 40 characters.`;
        else social.push({ label, url });
      });
      if (social.length > 12) errors.social ||= 'Enter 12 social links or fewer.';
      return {
        contact_address: f.contact_address, contact_phone: f.contact_phone, contact_whatsapp: wa, contact_email: f.contact_email,
        admissions_email: f.admissions_email, careers_email: f.careers_email, opening_hours: f.opening_hours, map_embed_url: f.map_embed_url, social,
      };
    },
  },
  {
    key: 'notifications', label: 'Notifications', area: 'settings', group: 'settings',
    description: () => (mail.configured()
      ? 'Who is emailed when someone submits a form. Separate several addresses with commas.'
      : 'Who is emailed when someone submits a form. NOTE: email delivery is not configured on the server yet, so submissions are saved in the admin but NOT emailed until SMTP is set up.'),
    fields: [
      { name: 'notify_enquiries_to', label: 'Send new enquiries to', maxlength: 600, hint: 'Comma-separated email addresses.' },
      { name: 'notify_applications_to', label: 'Send new job applications to', maxlength: 600, hint: 'Comma-separated email addresses. CVs are not attached; reviewers download them from the admin.' },
    ],
    load: (s) => ({ notify_enquiries_to: s.notify_enquiries_to, notify_applications_to: s.notify_applications_to }),
    parse: (f, errors) => ({
      notify_enquiries_to: checkEmailList(f, errors, 'notify_enquiries_to', 'Enquiry recipients'),
      notify_applications_to: checkEmailList(f, errors, 'notify_applications_to', 'Application recipients'),
    }),
  },
  {
    key: 'analytics', label: 'Analytics & SEO', area: 'settings', group: 'settings',
    description: 'Analytics scripts load only when an ID is entered. Leave blank to switch them off.',
    fields: [
      { name: 'ga4_id', label: 'Google Analytics 4 measurement ID', maxlength: 30, placeholder: 'G-XXXXXXXXXX' },
      { name: 'gtm_id', label: 'Google Tag Manager container ID', maxlength: 30, placeholder: 'GTM-XXXXXXX', hint: 'Use either GA4 or Tag Manager, not both, unless your analyst asks for it.' },
      { name: 'search_console_verification', label: 'Google Search Console verification code', maxlength: 400, hint: 'The content="…" value of the HTML tag verification method. You can paste the whole <meta> tag.' },
      { name: 'seo_default_description', label: 'Default page description', type: 'textarea', rows: 3, maxlength: 300, hint: 'Used in search results when a page has no description of its own.' },
      { name: 'og_image_url', label: 'Default social sharing image URL', maxlength: 500, hint: 'Shown when a page is shared on social media. 1200 × 630 pixels works best.' },
    ],
    load: (s) => ({ ga4_id: s.ga4_id, gtm_id: s.gtm_id, search_console_verification: s.search_console_verification, seo_default_description: s.seo_default_description, og_image_url: s.og_image_url }),
    parse: (f, errors) => {
      const ga = f.ga4_id.toUpperCase(); const gtm = f.gtm_id.toUpperCase();
      if (ga && !/^G-[A-Z0-9]+$/.test(ga)) errors.ga4_id = 'The GA4 ID looks like G-ABC123XYZ.';
      if (gtm && !/^GTM-[A-Z0-9]+$/.test(gtm)) errors.gtm_id = 'The Tag Manager ID looks like GTM-ABC1234.';
      let gsc = f.search_console_verification;
      const m = /content\s*=\s*["']([^"']*)["']/i.exec(gsc);
      if (m) gsc = m[1].trim();
      if (gsc && !/^[A-Za-z0-9_-]{10,100}$/.test(gsc)) errors.search_console_verification = 'The verification code should only contain letters, numbers, - and _.';
      const og = linkProblem(f.og_image_url);
      if (og) errors.og_image_url = og;
      return { ga4_id: ga, gtm_id: gtm, search_console_verification: gsc, seo_default_description: f.seo_default_description, og_image_url: f.og_image_url };
    },
  },
  {
    key: 'recruitment', label: 'Recruitment & privacy', area: 'settings', group: 'settings',
    fields: [
      { name: 'eoi_enabled', label: 'Accept general expressions of interest (CVs when no vacancy is open)', type: 'checkbox', hint: 'Only switch this on with management approval.' },
      { name: 'retention_applications_days', label: 'Keep job applications and CVs for (days)', type: 'number', required: true, min: 30, max: 1825, hint: '30–1825 days. Applies to applications received after you change it.' },
      { name: 'retention_enquiries_days', label: 'Keep enquiries for (days)', type: 'number', required: true, min: 30, max: 1825, hint: '30–1825 days. Applies to enquiries received after you change it.' },
      { name: 'programme_filter_threshold', label: 'Show programme filters when there are at least … programmes', type: 'number', required: true, min: 0, max: 100 },
    ],
    load: (s) => ({ eoi_enabled: s.eoi_enabled ? '1' : '', retention_applications_days: String(s.retention_applications_days), retention_enquiries_days: String(s.retention_enquiries_days), programme_filter_threshold: String(s.programme_filter_threshold) }),
    parse: (f) => ({ eoi_enabled: f.eoi_enabled === '1', retention_applications_days: parseInt(f.retention_applications_days, 10), retention_enquiries_days: parseInt(f.retention_enquiries_days, 10), programme_filter_threshold: parseInt(f.programme_filter_threshold, 10) }),
  },
  {
    key: 'homepage', label: 'Homepage copy', area: 'content', group: 'pages',
    description: 'The words on the homepage. Keep headings short.',
    fields: HOME_KEYS.map((k) => ({ name: k, label: HOME_LABELS[k] || ui.humanize(k.replace(/^home_/, '')), type: 'textarea', rows: /title|line\d|statement/.test(k) ? 2 : 3, maxlength: 600, required: k === 'home_hero_line1' })),
    load: (s) => Object.fromEntries(HOME_KEYS.map((k) => [k, s[k]])),
    parse: (f) => Object.fromEntries(HOME_KEYS.map((k) => [k, f[k]])),
  },
  {
    key: 'images', label: 'Images', area: 'content', group: 'pages',
    description: 'Photos used on the homepage and About page. Upload replacements in the Media Library and paste their URLs here. Every image needs alt text.',
    fields: [
      ...IMAGE_SLOTS.flatMap(([k, label]) => [{ section: label }, ...imgFields(`img_${k}`)]),
      ...Array.from({ length: GALLERY_COUNT }, (_, i) => [{ section: `Gallery item ${i + 1}` }, { name: `gal_${i}_label`, label: 'Caption', required: true, maxlength: 60 }, ...imgFields(`gal_${i}`)]).flat(),
    ],
    load: (s) => {
      const im = s.images || {}; const v = {};
      for (const [k] of IMAGE_SLOTS) { const x = im[k] || {}; v[`img_${k}_src`] = x.src || ''; v[`img_${k}_alt`] = x.alt || ''; v[`img_${k}_stock`] = x.stock ? '1' : ''; }
      const g = Array.isArray(im.gallery) ? im.gallery : [];
      for (let i = 0; i < GALLERY_COUNT; i++) { const x = g[i] || {}; v[`gal_${i}_label`] = x.label || ''; v[`gal_${i}_src`] = x.src || ''; v[`gal_${i}_alt`] = x.alt || ''; v[`gal_${i}_stock`] = x.stock ? '1' : ''; }
      return v;
    },
    parse: (f, errors, s) => {
      const images = { ...(s.images || {}) };
      for (const [k] of IMAGE_SLOTS) images[k] = { src: f[`img_${k}_src`], alt: f[`img_${k}_alt`], stock: f[`img_${k}_stock`] === '1' };
      images.gallery = Array.from({ length: GALLERY_COUNT }, (_, i) => ({ label: f[`gal_${i}_label`], src: f[`gal_${i}_src`], alt: f[`gal_${i}_alt`], stock: f[`gal_${i}_stock`] === '1' }));
      return { images };
    },
  },
  {
    key: 'slideshow', label: 'Hero slideshow', area: 'content', group: 'pages',
    description: 'Up to five photos shown in the framed slideshow beside the homepage headline. They crossfade every 6 seconds. Landscape photos with the people near the centre work best. Leave a slide empty to skip it.',
    fields: Array.from({ length: 5 }, (_, i) => [
      { section: `Slide ${i + 1}` },
      { name: `sl_${i}_src`, label: 'Image URL', required: i === 0, maxlength: 500, image: true },
      { name: `sl_${i}_alt`, label: 'Description (alt text)', maxlength: 250 },
      { name: `sl_${i}_stock`, label: 'Temporary stock photo', type: 'checkbox', hint: stockHint },
    ]).flat(),
    load: (s) => {
      const v = {}; const list = Array.isArray(s.hero_slides) ? s.hero_slides : [];
      for (let i = 0; i < 5; i++) { const x = list[i] || {}; v[`sl_${i}_src`] = x.src || ''; v[`sl_${i}_alt`] = x.alt || ''; v[`sl_${i}_stock`] = x.stock ? '1' : ''; }
      return v;
    },
    parse: (f, errors) => {
      const hero_slides = [];
      for (let i = 0; i < 5; i++) {
        if (!f[`sl_${i}_src`]) continue;
        if (!f[`sl_${i}_alt`]) errors[`sl_${i}_alt`] = `Describe slide ${i + 1} for people who cannot see it.`;
        hero_slides.push({ src: f[`sl_${i}_src`], alt: f[`sl_${i}_alt`], stock: f[`sl_${i}_stock`] === '1' });
      }
      return { hero_slides };
    },
  },
  {
    key: 'announcement', label: 'Announcement bar', area: 'content', group: 'pages',
    description: 'A short notice shown at the top of every page, for example an intake date or a recruitment drive. Switch it off, or set an end date, when it is no longer true.',
    fields: [
      { name: 'announcement_enabled', label: 'Show the announcement on the website', type: 'checkbox' },
      { name: 'announcement_text', label: 'Message', maxlength: 160, hint: 'One short sentence, e.g. “We are recruiting English and communication trainers.”' },
      { name: 'announcement_link', label: 'Link (optional)', maxlength: 500, hint: 'A page on this site such as /careers, or a full https:// link.' },
      { name: 'announcement_link_label', label: 'Link text', maxlength: 40, placeholder: 'Learn more' },
      { name: 'announcement_start', label: 'Show from (optional)', type: 'date' },
      { name: 'announcement_end', label: 'Show until (optional)', type: 'date', hint: 'The bar hides itself automatically after this date.' },
    ],
    load: (s) => ({
      announcement_enabled: s.announcement_enabled ? '1' : '', announcement_text: s.announcement_text, announcement_link: s.announcement_link,
      announcement_link_label: s.announcement_link_label, announcement_start: s.announcement_start, announcement_end: s.announcement_end,
    }),
    parse: (f, errors) => {
      if (f.announcement_enabled === '1' && !f.announcement_text) errors.announcement_text = 'Write a message, or untick “Show the announcement”.';
      const lp = linkProblem(f.announcement_link);
      if (lp) errors.announcement_link = lp;
      if (f.announcement_start && f.announcement_end && f.announcement_end < f.announcement_start) errors.announcement_end = '“Show until” must be on or after “Show from”.';
      return {
        announcement_enabled: f.announcement_enabled === '1', announcement_text: f.announcement_text, announcement_link: f.announcement_link,
        announcement_link_label: f.announcement_link_label, announcement_start: f.announcement_start, announcement_end: f.announcement_end,
      };
    },
  },
  {
    key: 'legal', label: 'Legal pages', area: 'content', group: 'pages',
    description: 'Privacy policy and terms of use. Have them reviewed by Rockford’s legal or privacy owner, then delete the “Draft for review” line at the top.',
    fields: [
      { name: 'legal_privacy', label: 'Privacy policy', type: 'markdown', rows: 22, required: true, maxlength: 100000 },
      { name: 'legal_terms', label: 'Terms of use', type: 'markdown', rows: 18, required: true, maxlength: 100000 },
    ],
    load: (s) => ({ legal_privacy: s.legal_privacy, legal_terms: s.legal_terms }),
    parse: (f) => ({ legal_privacy: f.legal_privacy, legal_terms: f.legal_terms }),
  },
];
const PAGE_DESCRIPTIONS = {
  homepage: 'Headlines and paragraphs on the homepage.',
  images: 'Hero, section and gallery photos, with alt text and the stock-photo label.',
  legal: 'Privacy policy and terms of use (Markdown).',
  announcement: 'A short notice at the top of every page, with optional start and end dates.',
  slideshow: 'Up to five photos that crossfade in the framed slideshow beside the homepage headline.',
};

module.exports = {
  EMAIL_RE, str, splitLines, parseJsonArr, validDate, imageUrlProblem, linkProblem, readForm, validateFields,
  ENTITIES, toForm, toDb, SECTIONS, PAGE_DESCRIPTIONS, IMAGE_SLOTS,
};
