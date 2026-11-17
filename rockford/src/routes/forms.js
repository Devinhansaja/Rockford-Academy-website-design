'use strict';
/*
 * Public form handlers: enquiries, job applications and expressions of interest.
 * Flow: rate limit → anti-spam (signed time token + honeypot) → server validation →
 * (CV type/content checks) → store → reference → notify team → confirm to sender → redirect.
 */
const config = require('../config');
const { q, now, audit } = require('../db');
const security = require('../security');
const uploads = require('../uploads');
const mail = require('../mail');
const content = require('../content');
const { renderers } = require('./public');

const EMAIL_RE = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/;
const PHONE_RE = /^[+()\d\s-]{7,20}$/;
const DAY = 24 * 60 * 60 * 1000;

const clean = (v, max) => String(v === undefined || v === null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max);
const recipients = (list) => String(list || '').split(',').map((s) => s.trim()).filter(Boolean);

function spamCheck(fields) {
  if (fields.website) return 'honeypot';
  return security.checkFormToken(fields._t);
}

function adminLink(path) { return config.siteUrl ? config.siteUrl + path : path + ' (sign in to the website admin)'; }

/* ── Enquiries ───────────────────────────────────────────── */
function validateEnquiry(f) {
  const v = {
    topic: ['general', 'programmes', 'careers', 'partnerships'].includes(f.topic) ? f.topic : 'general',
    programme_id: /^\d+$/.test(f.programme_id || '') ? Number(f.programme_id) : null,
    name: clean(f.name, 120), email: clean(f.email, 200).toLowerCase(), phone: clean(f.phone, 30),
    message: clean(f.message, 3000), consent: f.consent === '1',
  };
  const e = {};
  if (v.name.length < 2) e.name = 'Enter your full name.';
  if (!EMAIL_RE.test(v.email)) e.email = 'Enter a valid email address, like name@example.com.';
  if (v.phone && !PHONE_RE.test(v.phone)) e.phone = 'Enter a valid telephone number, or leave it blank.';
  if (v.message.length < 10) e.message = 'Please write a short message (at least 10 characters).';
  if (!v.consent) e.consent = 'Please confirm you agree to the privacy policy so we can reply.';
  return { v, e };
}

function rerender(ctx, from, form, status) {
  if (from.startsWith('programme:')) {
    const p = content.programme(from.slice(10));
    if (p) return renderers.programme(ctx, p, form, status);
  }
  return renderers.contact(ctx, form, status);
}

async function enquire(ctx) {
  const { fields } = await ctx.body({ limit: 32 * 1024 });
  const from = String(fields.from || 'contact').slice(0, 120);
  if (!security.rateLimit('enq:' + ctx.ip, 6, 10 * 60 * 1000)) {
    return rerender(ctx, from, { values: fields, errors: { form: 'You have sent several messages in a short time. Please wait a few minutes and try again.' } }, 429);
  }
  const spam = spamCheck(fields);
  if (spam === 'honeypot') return ctx.redirect('/thank-you?form=enquiry');
  if (spam) return rerender(ctx, from, { values: fields, errors: { form: spam === 'too_fast' ? 'That was very fast. Please check your details and send again.' : 'This form expired. Please send it again.' } }, 400);

  const { v, e } = validateEnquiry(fields);
  let programme = null;
  if (v.programme_id) { programme = content.programmeById(v.programme_id); if (!programme) v.programme_id = null; }
  if (Object.keys(e).length) return rerender(ctx, from, { values: fields, errors: e }, 422);

  const ref = security.reference('RA-ENQ');
  const type = programme || v.topic === 'programmes' ? 'programme' : (v.topic === 'careers' ? 'careers' : 'general');
  const retention = Number(ctx.settings.retention_enquiries_days) || 365;
  const row = q.run(`INSERT INTO enquiries (ref, type, programme_id, topic, name, email, phone, message, created_at, retention_until)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ref, type, v.programme_id, v.topic, v.name, v.email, v.phone, v.message, now(), now() + retention * DAY);
  audit(null, 'enquiry.received', ref);

  const s = ctx.settings;
  const team = recipients(s.notify_enquiries_to || s.admissions_email || s.contact_email);
  const topicLabel = programme ? `Programme: ${programme.title}` : ({ general: 'General', programmes: 'Programmes', careers: 'Careers', partnerships: 'Partnerships' }[v.topic]);
  if (team.length) {
    await mail.send({
      to: team, replyTo: v.email, purpose: 'enquiry-notify',
      subject: `New website enquiry ${ref} (${topicLabel})`,
      text: `A new enquiry was submitted on the website.\n\nReference: ${ref}\nTopic: ${topicLabel}\nName: ${v.name}\nEmail: ${v.email}\nTelephone: ${v.phone || '(not given)'}\n\nMessage:\n${v.message}\n\nView in admin: ${adminLink('/admin/enquiries/' + row.lastInsertRowid)}`,
    });
  }
  const confirm = await mail.send({
    to: v.email, purpose: 'enquiry-confirm',
    subject: `We received your message (${ref})`,
    text: `Dear ${v.name},\n\nThank you for contacting ${s.site_name}. We have received your message and will reply as soon as possible.\n\nYour reference: ${ref}\n\n${s.site_name}\n${s.tagline}`,
  });
  ctx.redirect(`/thank-you?form=enquiry&ref=${encodeURIComponent(ref)}${confirm.delivered ? '&e=1' : ''}`);
}

/* ── Applications ────────────────────────────────────────── */
function validateApplication(f) {
  const v = {
    name: clean(f.name, 120), email: clean(f.email, 200).toLowerCase(), phone: clean(f.phone, 30),
    qualifications: clean(f.qualifications, 3000), experience: clean(f.experience, 4000), message: clean(f.message, 4000),
    consent: f.consent === '1',
  };
  const e = {};
  if (v.name.length < 2) e.name = 'Enter your full name.';
  if (!EMAIL_RE.test(v.email)) e.email = 'Enter a valid email address, like name@example.com.';
  if (!PHONE_RE.test(v.phone)) e.phone = 'Enter a valid telephone number.';
  if (v.qualifications.length < 2) e.qualifications = 'Tell us about your relevant qualifications.';
  if (v.experience.length < 3) e.experience = 'Tell us about your work experience (write "None yet" if this is your first role).';
  if (!v.consent) e.consent = 'Please confirm the declaration so we can process your application.';
  return { v, e };
}

async function handleApplication(ctx, vacancy) {
  const isEoi = !vacancy;
  const rerenderForm = (form, status) => (isEoi ? renderers.careers(ctx, form, status) : renderers.vacancy(ctx, vacancy, form, status));

  // Accept up to 2× the CV limit so slightly-too-large files get a friendly inline error instead of a 413.
  const { fields, files } = await ctx.body({ limit: config.cvMaxBytes * 2 + 256 * 1024 });
  if (!security.rateLimit('app:' + ctx.ip, 4, 30 * 60 * 1000)) {
    return rerenderForm({ values: fields, errors: { form: 'You have submitted several applications in a short time. Please wait and try again later.' } }, 429);
  }
  const spam = spamCheck(fields);
  if (spam === 'honeypot') return ctx.redirect('/thank-you?form=application');
  if (spam) return rerenderForm({ values: fields, errors: { form: 'This form expired or was sent too quickly. Please check your details, attach your CV and send again.' } }, 400);

  const { v, e } = validateApplication(fields);
  const cv = files.find((f) => f.field === 'cv');
  const cvCheck = uploads.validateCv(cv);
  if (cvCheck.error) e.cv = cvCheck.error;
  if (Object.keys(e).length) return rerenderForm({ values: fields, errors: e }, 422);

  const stored = uploads.saveCv(cv, cvCheck.kind);
  const ref = security.reference('RA-APP');
  const retention = Number(ctx.settings.retention_applications_days) || 365;
  const position = isEoi ? 'General expression of interest' : vacancy.title;
  let row;
  try {
    row = q.run(`INSERT INTO applications (ref, vacancy_id, position, name, email, phone, qualifications, experience, message, cv_file, cv_name, cv_mime, cv_size, created_at, retention_until)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ref, isEoi ? null : vacancy.id, position, v.name, v.email, v.phone, v.qualifications, v.experience, v.message,
    stored.file, clean(cv.filename, 150) || 'cv' + cvCheck.kind.ext, stored.mime, stored.size, now(), now() + retention * DAY);
  } catch (err) {
    uploads.deleteCv(stored.file); // never leave an orphaned CV behind
    throw err;
  }
  audit(null, 'application.received', ref);

  const s = ctx.settings;
  const team = recipients(s.notify_applications_to || s.careers_email);
  if (team.length) {
    // Personal data stays in the admin; the notification carries only what the team needs to triage.
    await mail.send({
      to: team, purpose: 'application-notify',
      subject: `New job application ${ref}: ${position}`,
      text: `A new job application was submitted on the website.\n\nReference: ${ref}\nPosition: ${position}\nApplicant: ${v.name}\n\nThe CV is stored securely and is not attached to this email.\nReview it in the admin: ${adminLink('/admin/applications/' + row.lastInsertRowid)}`,
    });
  }
  const confirm = await mail.send({
    to: v.email, purpose: 'application-confirm',
    subject: `Application received: ${position} (${ref})`,
    text: `Dear ${v.name},\n\nThank you for applying for "${position}" at ${s.site_name}. Your application and CV have been received and stored securely.\n\nYour application reference: ${ref}\n\nOur recruitment team reviews every application and will contact shortlisted candidates. Your application will be deleted automatically after ${retention} days, or sooner if you ask us.\n\n${s.site_name}`,
  });
  ctx.redirect(`/thank-you?form=application&ref=${encodeURIComponent(ref)}${confirm.delivered ? '&e=1' : ''}`);
}

function register(app) {
  const r = app.router;
  r.post('/enquire', enquire);
  r.post('/careers/interest', async (ctx) => {
    if (!ctx.settings.eoi_enabled) return false; // 404 when not approved
    return handleApplication(ctx, null);
  });
  r.post('/careers/:slug/apply', async (ctx) => {
    const v = content.vacancy(ctx.params.slug);
    if (!v) return false;
    if (!content.vacancyIsOpen(v)) { await ctx.body({ limit: config.cvMaxBytes + 256 * 1024 }).catch(() => {}); return ctx.redirect('/careers/' + v.slug); }
    return handleApplication(ctx, v);
  });
}

module.exports = { register, validateEnquiry, validateApplication };
