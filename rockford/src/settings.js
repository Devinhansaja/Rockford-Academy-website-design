'use strict';
/*
 * Site Settings (editable in Admin → Website Settings). Values are JSON in the `settings` table;
 * anything not saved falls back to DEFAULTS. Empty contact values hide the related UI.
 */
const { q } = require('./db');

const U = (id) => `https://images.unsplash.com/photo-${id}`;

const DEFAULTS = {
  // Brand
  site_name: 'Rockford Academy',
  tagline: 'Preparing people for opportunity.',
  logo_url: '', // empty = built-in wordmark until the approved logo is uploaded

  // Contact (only confirmed details; empty = hidden)
  contact_address: '',
  contact_phone: '',
  contact_whatsapp: '', // international format digits, e.g. 94771234567
  contact_email: '',
  careers_email: '',
  admissions_email: '',
  opening_hours: '',
  map_embed_url: '', // Google Maps "Embed a map" src URL only
  social: [], // [{ label: 'Instagram', url: 'https://…' }]

  // Notifications (who receives form submissions)
  notify_enquiries_to: '',
  notify_applications_to: '',

  // Analytics & SEO
  ga4_id: '',
  gtm_id: '',
  search_console_verification: '',
  seo_default_description: 'Rockford Academy is an English academy in Sri Lanka preparing young people for the opportunities of tomorrow through spoken English, communication skills, confidence building and personality development.',
  og_image_url: '',

  // Recruitment & privacy
  eoi_enabled: false, // general expression-of-interest form (requires management approval)
  retention_applications_days: 365,
  retention_enquiries_days: 365,
  programme_filter_threshold: 4,

  // Announcement bar (brief: "publish and update … announcements")
  announcement_enabled: false,
  announcement_text: '',
  announcement_link: '',
  announcement_link_label: 'Learn more',
  announcement_start: '', // YYYY-MM-DD, Sri Lanka time
  announcement_end: '',

  // Homepage hero slideshow: up to 5 full-screen photos, main subject on the right-hand side.
  hero_slides: [
    { src: U('1758270705317-3ef6142d306f'), alt: 'Young adults collaborating around a laptop', stock: true },
    { src: U('1715610258704-e8f9f5710fe0'), alt: 'A confident young woman presenting to an audience', stock: true },
    { src: U('1682962232755-f1d051ddb638'), alt: 'Young adults taking part in an interactive group workshop', stock: true },
    { src: U('1758270705031-ebd46917a454'), alt: 'A lecturer guiding students in a modern classroom', stock: true },
    { src: U('1549057446-9f5c6ac91a04'), alt: 'Confident young adults walking together through a campus', stock: true },
  ],

  // Homepage copy
  home_hero_eyebrow: 'A world of opportunity',
  home_hero_line1: 'Beyond English.',
  home_hero_line2: 'Beyond the Classroom.',
  home_hero_sub: 'Preparing young people for the opportunities of tomorrow through communication, confidence and personal development.',
  home_about_statement: 'The world needs more than qualifications; it needs people ready for opportunity.',
  home_about_text: 'It needs confident thinkers, effective communicators and capable leaders. Rockford exists to help develop that generation.',
  home_dims_intro: 'Six connected areas of development woven through every Rockford experience. English is the starting point, not the finish line.',
  home_journey_statement: 'From discovering your potential to transforming your future.',
  home_difference_statement: 'Learning designed for life.',
  home_difference_sub: 'Real-world communication, interactive learning and confidence through participation.',
  home_programmes_title: 'Find the future you want to build',
  home_programmes_intro: 'Programmes for school leavers, young adults and young professionals. Details are published here as soon as they are confirmed.',
  home_careers_title: 'Help shape the next generation',
  home_careers_lede: 'Join a team committed to preparing young people for a world of opportunity.',
  home_final_title: 'Your tomorrow starts today.',
  home_final_text: "Discover what's possible when confidence meets opportunity.",

  // Images. `stock: true` marks temporary licensed stock photos (shown with an "Illustrative photo" label).
  images: {
    hero: { src: U('1571260899304-425eee4c7efc'), alt: 'A young woman holding textbooks in a bright classroom with other students', stock: true },
    journey1: { src: U('1686624386665-4cd01b96d0f6'), alt: 'Young men working together and writing notes at a table', stock: true },
    journey2: { src: U('1712903911017-7c10a3c4b3e5'), alt: 'A young woman presenting ideas on a board to her group', stock: true },
    journey3: { src: U('1637073849563-5b0ac780ec34'), alt: 'A presenter speaking to a small group in a meeting room', stock: true },
    difference: { src: U('1549057446-9f5c6ac91a04'), alt: 'A group of young adults walking and laughing together outdoors', stock: true },
    programmes: { src: U('1517486808906-6ca8b3f04846'), alt: 'Friends sitting together on a bench outdoors, smiling', stock: true },
    about: { src: U('1682962232755-f1d051ddb638'), alt: 'A group of young people laughing around a wooden table', stock: true },
    approach: { src: U('1715610258704-e8f9f5710fe0'), alt: 'A young woman speaking into a microphone in front of an audience', stock: true },
    careers: { src: U('1758270705317-3ef6142d306f'), alt: 'Students gathered around a laptop working on a task together', stock: true },
    gallery: [
      { label: 'Classrooms', src: U('1758270704763-22072a90d3b6'), alt: 'Students talking and laughing in a lecture hall', stock: true },
      { label: 'Collaborative spaces', src: U('1682962232755-f1d051ddb638'), alt: 'A group of young people laughing around a wooden table', stock: true },
      { label: 'Presentation studio', src: U('1715610258704-e8f9f5710fe0'), alt: 'A young woman speaking into a microphone in front of an audience', stock: true },
      { label: 'Workshops', src: U('1758270705317-3ef6142d306f'), alt: 'Students gathered around a laptop working on a task together', stock: true },
    ],
  },

  // Legal pages (Markdown). Drafts must be reviewed by Rockford's legal/privacy owner before launch.
  legal_privacy: `_Draft for review by Rockford Academy before publication._

## Who we are
Rockford Academy ("Rockford", "we") operates this website.

## What we collect
- **Enquiries:** your name, email address, telephone number (optional) and message.
- **Job applications:** your name, email address, telephone number, qualifications, work experience, cover message and CV.

## Why we collect it
We use this information only to respond to your enquiry or to assess your job application.

## How long we keep it
Enquiries and job applications are deleted automatically after a fixed retention period set by Rockford, unless you ask us to delete them sooner.

## Who can see it
Only authorised Rockford staff. CVs are stored privately and are never published on the website. We do not sell your information. We do not send personal information to analytics services.

## Your choices
You can ask us to access, correct or delete your information using the contact details on our Contact page.

## Cookies and analytics
This website uses a strictly necessary cookie for staff sign-in. If analytics are enabled, they measure page visits and anonymous events only.`,
  legal_terms: `_Draft for review by Rockford Academy before publication._

## Using this website
The content on this website is provided for general information about Rockford Academy and its programmes. Programme details, schedules and availability may change and are confirmed only when published.

## Applications and enquiries
Submitting an enquiry or job application does not create a contract or guarantee a place or position.

## Intellectual property
Text, design and branding on this website belong to Rockford Academy unless stated otherwise. Photographs labelled "Illustrative photo" are licensed stock images.

## Contact
Questions about these terms can be sent using the details on our Contact page.`,
};

let cache = null;

function load() {
  const out = JSON.parse(JSON.stringify(DEFAULTS));
  for (const row of q.all('SELECT key, value FROM settings')) {
    try { out[row.key] = JSON.parse(row.value); } catch { /* ignore corrupt value */ }
  }
  cache = out;
  return out;
}

const all = () => cache || load();
const get = (key) => all()[key];

function set(values) {
  const stmt = 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
  for (const [k, v] of Object.entries(values)) {
    if (!(k in DEFAULTS)) continue; // only known keys
    q.run(stmt, k, JSON.stringify(v));
  }
  cache = null;
}

module.exports = { DEFAULTS, all, get, set };
