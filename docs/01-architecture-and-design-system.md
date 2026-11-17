# Rockford Academy — Phase 1: Architecture, Design System & Homepage Concept

> **Platform update (16 Nov 2026):** at the client's instruction the site is **not** built on WordPress. It is a custom, zero-dependency Node.js application with its own admin panel (`rockford/`). The content model, roles, recruitment flow and security rules below still apply. WordPress-specific names (theme, plugin, CPTs, `theme.json`) map to the app's database tables, admin sections and CSS tokens. See `rockford/README.md` and `rockford/docs/`.

**Status:** Draft for client approval · 16 Nov 2026
**Creative concept:** Beyond Tomorrow · **Headline:** Beyond English. Beyond the Classroom. · **Promise:** Preparing people for opportunity.

This document covers step one of the execution plan (architecture, design system, homepage concept). The homepage concept lives in `site/` and is a static, high-fidelity build whose markup, tokens and components map one-to-one onto the WordPress block theme planned for Phase 3. Nothing beyond the homepage is built until the homepage is approved.

---

## 1. Sitemap & URL structure

| Page | URL | Template | Source |
|---|---|---|---|
| Home | `/` | `front-page.html` | Block patterns, Site Settings |
| About Us | `/about/` | `page-about.html` | Page content (patterns) |
| Our Programmes | `/programmes/` | `archive-rf_programme.html` | CPT `rf_programme` |
| Programme detail | `/programmes/{slug}/` | `single-rf_programme.html` | CPT `rf_programme` |
| Our Approach | `/our-approach/` | `page-approach.html` | Page content (patterns) |
| Careers | `/careers/` | `archive-rf_vacancy.html` | CPT `rf_vacancy` |
| Vacancy detail + application | `/careers/{slug}/` | `single-rf_vacancy.html` | CPT `rf_vacancy` + application form |
| Contact Us | `/contact/` | `page-contact.html` | Site Settings + enquiry form |
| News & Insights | `/news/` | `home.html` (posts index) | Posts (`post`) |
| Article | `/news/{slug}/` | `single.html` | Posts |
| Privacy Policy | `/privacy-policy/` | `page-legal.html` | Page content |
| Terms & Conditions | `/terms/` | `page-legal.html` | Page content |
| 404 | — | `404.html` | Template |

"Articles" in the brief use the native `post` type (better SEO plugin, feed and editor support); "Announcements" is a `rf_announcement` CPT for short, time-bound notices (e.g. intake dates) that can surface in a site-wide bar.

Primary navigation: Home · About · Programmes · Our Approach · Careers · Contact · **Get in Touch** (button → `/contact/`). News sits in the footer until there is enough content to justify primary nav.

---

## 2. Platform architecture

```
wp-content/
├── themes/rockford/                 ← presentation only (swappable)
│   ├── theme.json                   ← design tokens (colours, type, spacing, layout)
│   ├── templates/  parts/  patterns/
│   ├── assets/css  assets/js  assets/fonts (self-hosted Manrope + Inter, woff2)
│   └── blocks/                      ← custom presentational blocks
│       ├── opportunity-frame/  hero/  dimension-grid/  journey/
│       ├── programme-grid/  vacancy-list/  gallery/  testimonials/
└── plugins/rockford-core/           ← content + functionality (survives theme change)
    ├── CPTs, taxonomies, meta (register_post_meta, REST-exposed)
    ├── Site Settings screen (logo, contact, social, homepage copy, analytics IDs)
    ├── Forms: enquiry, programme enquiry, job application, expression of interest
    ├── Recruitment: applications table, private CV storage, statuses, retention
    ├── Roles & capabilities
    ├── Email (wp_mail → SMTP/transactional provider), notifications, templates
    └── SEO helpers: schema for Programme (Course) & Vacancy (JobPosting), analytics events
```

**Why the split:** if the theme is ever replaced, programmes, vacancies, applications and enquiries remain intact. Dynamic blocks in the theme read data via the plugin's PHP API, so the theme never owns data.

**No page builder.** Gutenberg + custom blocks + locked patterns. Staff edit copy and images in place; layout integrity is protected by template locking where appropriate.

### Recommended production stack
WordPress (latest) · PHP 8.2+ · MariaDB 10.6+ · managed WordPress hosting with daily off-site backups, staging, SSL, WAF/malware scanning · SMTP/transactional email (e.g. Google Workspace SMTP relay, Postmark or Amazon SES — client choice) · Optional GSAP (not needed for the current concept; all motion is CSS + IntersectionObserver).

Minimal plugins: an SEO plugin (Yoast or Rank Math — or our own lightweight meta fields), a 2FA plugin (e.g. Two-Factor), a backup plugin only if hosting backups are insufficient, an SMTP plugin only if not handled in `rockford-core`.

---

## 3. Content model

### `rf_programme` (Programmes)
| Field | Type | Notes |
|---|---|---|
| Title, excerpt, featured image, body | core | Body uses patterns for structured outcomes |
| `audience` | text | e.g. "School leavers" |
| `age_group` | text | |
| `duration` | text | Free text so nothing is forced into a fabricated format |
| `format` | taxonomy `rf_format` | In-person / Online / Blended |
| `category` | taxonomy `rf_programme_cat` | |
| `learning_objectives` | repeatable text | |
| `entry_requirements` | rich text | |
| `schedule` | rich text | Optional; hidden when empty |
| `availability` | select | `coming_soon` · `enrolling` · `waitlist` · `closed` |
| `show_enquire` | bool | |

Rules: empty fields are **not rendered** (no "TBC" filler). If zero programmes are published the grid shows the Coming Soon state. Filtering appears automatically once ≥ 4 programmes are published (configurable).

### `rf_vacancy` (Vacancies)
Title, summary, description, `responsibilities` (repeatable), `qualifications` (repeatable), `employment_type` (Full-time / Part-time / Contract / Visiting), `location`, `deadline` (date; auto-closes after), `status` (`open` · `closed` · `archived`), taxonomy `rf_job_cat`. Outputs `JobPosting` structured data only while open.

### `rf_testimonial`
Name, role/context, portrait, quote, optional video URL, `consent_confirmed` (required to publish), `approved_by`, date. The homepage section renders **only** when ≥ 1 published testimonial with consent exists.

### `rf_announcement`
Title, short text, link, start/end dates.

### Non-public records (custom tables, not posts)
- `rf_applications`: reference (e.g. `RA-2026-000123`), vacancy ID, name, email, phone, qualifications, experience, message, CV file key, status (`received` · `reviewing` · `shortlisted` · `unsuccessful` · `hired`), created/updated, retention_until.
- `rf_enquiries`: reference, type (general/programme), programme ID, name, email, phone, message, consent, created, retention_until.

Custom tables keep personal data out of `wp_posts`/REST/search/exports and make retention purging simple.

---

## 4. Roles & permissions

| Role | Can |
|---|---|
| Administrator | Everything, Site Settings, users |
| Content Editor (custom) | Pages, posts, programmes, testimonials, announcements, media. **No** applications/enquiries access |
| Recruitment Manager (custom) | Vacancies; view/search applications; download CVs; update status; delete per retention policy |
| Admissions (custom, optional) | View/export programme & general enquiries |

Capabilities: `rf_manage_vacancies`, `rf_view_applications`, `rf_download_cv`, `rf_delete_applications`, `rf_view_enquiries`. 2FA enforced for all roles with access to personal data.

---

## 5. Forms & recruitment flow

1. Client-side validation for UX; **authoritative validation on the server**.
2. Nonce (CSRF), honeypot + time-trap, optional Cloudflare Turnstile, per-IP rate limiting (transients/object cache).
3. CV: PDF/DOCX only; size limit configurable (default 5 MB); extension **and** MIME sniff (`finfo`) **and** magic-byte check (`%PDF-` / ZIP+`word/` structure); randomised filename.
4. CVs stored **outside the public web root** (or in a deny-all directory) and streamed only via an authenticated, capability-checked download handler — never a public media URL, never in the Media Library.
5. Record stored → reference generated → recruitment team notified (no CV attached by default; link to the admin record) → applicant confirmation email → success message with reference.
6. Retention: configurable period (e.g. 12 months for unsuccessful applications); daily cron purges records and files; manual delete available to authorised roles.
7. Analytics: only event names and non-personal parameters (e.g. `vacancy_slug`). Never names, emails, phone numbers or CV content.

No live integrations will be simulated. Where SMTP, Turnstile, GA4, Maps or WhatsApp details are missing, Site Settings shows a clear "Not configured" state and the related front-end element is hidden or falls back gracefully.

---

## 6. Design system

### 6.1 Colour tokens (from the client's brief PDF)
The palette is taken directly from the colours used in *Rockford Website Development & Brand Direction Brief*: "Deep navy — primary · White / light grey — backgrounds · Warm gold / orange — accent". The site is now predominantly white and light grey, with navy used for emphasis bands and gold as the accent.

| Token | Hex | Source in brief | Usage |
|---|---|---|---|
| `--rf-navy` | `#14243B` | Header bars, "Deep navy" swatch | Primary: headings, dark bands, buttons |
| `--rf-navy-deep` | `#0D192B` | Derived (darker step) | Footer, careers band |
| `--rf-ink` | `#1D2938` | Body text | Body copy |
| `--rf-blue` | `#234B73` | Sub-headings | Eyebrows, accent word in hero, card titles |
| `--rf-gold` | `#D9A441` | Gold rules | Accent rules, buttons, frame accent |
| `--rf-gold-tint` | `#F8EBD0` | "Warm gold / orange" swatch | Accent surfaces (final CTA, accent tile) |
| `--rf-gold-ink` | `#8A6418` | Derived for AA | Gold-coloured *text* on light backgrounds |
| `--rf-light` | `#F2F5F8` | Panel / table backgrounds | Alternate section backgrounds |
| `--rf-white` | `#FFFFFF` | Page background | Main background |
| `--rf-slate` | `#5B6878` | Secondary text | Secondary text |
| `--rf-border` | `#D9E0E7` | Table borders | Hairlines |

All colours are CSS custom properties (and `theme.json` presets in production), so the palette and logo can be updated globally from one place. Final colours must still complement the approved logo once it is supplied (brief §3).

### 6.2 Typography
- **Display:** Manrope (700/800), tight tracking (−0.035em) at large sizes.
- **Body/UI:** Inter (400/500/600).
- Fluid scale (clamp): Display XL 56→120px · Display L 44→88px · H2 36→64px · H3 22→28px · Body L 18→20px · Body 16–17px · Label 12–13px uppercase, +0.14em tracking.
- Production: self-hosted woff2 subsets, `font-display: swap`, preload the display weight used above the fold.

### 6.3 Layout
12-column grid · max content width 1440px · gutters 24px (desktop) / 16px (mobile) · section spacing `clamp(96px, 12vw, 176px)` · editorial rules (1px hairlines) instead of boxed cards wherever possible · square corners (2px max radius) to avoid the rounded-card template look.

### 6.4 The Opportunity Frame
An open rectangular outline with an **interrupted top-right corner** and two short **gold accent strokes** that flank the opening — a doorway into the future.

- **States:** *closed* (complete rectangle) → *open* (corner retracts, gold accents extend). Triggered once when the element enters the viewport; 1.1s, `cubic-bezier(.65,0,.35,1)`.
- **Construction:** pure CSS (edge strokes + corner pieces + accents), pixel-precise at any size, `aria-hidden`, `pointer-events: none` — it can never obstruct content.
- **Variants:** `offset` (frame sits outside an image, hero), `inset` (inside a card), `large` (section backgrounds), light/dark stroke.
- **Uses:** hero photo, dimension tiles, programme cards, gallery hover, careers panel, final CTA, logo mark.
- **Reduced motion:** renders directly in the open state.

### 6.5 Components
Buttons (primary gold / secondary outline / text-link with animated underline) · labels with gold rule · numbered editorial lists · programme card · vacancy row · status chips · empty-state panels · image placeholders · accordion (Phase 3) · form fields (Phase 4).

### 6.6 Motion
CSS transitions + IntersectionObserver reveals (fade-up, staggered words), Opportunity Frame opening, gentle image scale on hover, nav underline, journey progress line driven by scroll position (passive listener, `requestAnimationFrame`). No smooth-scroll hijacking, no loaders, no 3D. `prefers-reduced-motion: reduce` disables all non-essential motion.

---

## 7. Homepage concept — section map

| # | Section | Surface | Data / state |
|---|---|---|---|
| 01 | Navigation | Transparent → solid navy on scroll | Site Settings menu |
| 02 | Cinematic hero | Navy | Editable copy, image/optional muted video with pause control |
| 03 | Manifesto | Ivory | Editable copy |
| 04 | Six Dimensions of Growth | White | Fixed pattern; presented as *development areas*, not courses |
| 05 | The Rockford Journey | Deep navy | **Proposed framework — awaiting approval** |
| 06 | Programme discovery | Ivory | CMS; **Coming Soon** state while none are published |
| 07 | The Rockford Difference | Navy | Editable copy |
| 08 | Learning environment | White | CMS gallery; placeholders flagged as non-Rockford |
| 09 | Stories of transformation | — | **Hidden** until approved testimonials exist |
| 10 | Careers | Deep navy | CMS vacancies; EOI fallback **if approved by management** |
| 11 | Final CTA | Ivory | Editable copy |
| 12 | Footer | Deep navy | Only confirmed contact/social details render |

**Alignment with the client's Website Development & Brand Direction Brief:** all eight homepage blocks the brief requires (Hero, Purpose, What We Develop, Difference, Programmes, Environment, Careers, Contact) are covered. The brief's "Contact" block is merged into Section 11: WhatsApp, phone and map options render there automatically once official details are confirmed. Its three primary CTAs (Explore Our Programmes, Join Our Team, Get in Touch) all appear above the footer.

The concept has a **Review notes** toggle (bottom-left) that labels every placeholder, proposal and empty CMS state for reviewers. Add `?demo=1` to the URL to preview programme and vacancy cards with clearly marked sample data (layout review only — never published).

---

## 8. Information needed from Rockford Academy

1. Approved logo files (SVG) — the concept uses a provisional wordmark.
2. Confirmation of the Discover → Develop → Practise → Transform framework.
3. Programme list (only confirmed details: name, audience, duration, format, availability).
4. Current vacancies and approval for a general expression-of-interest form.
5. Confirmed contact details: address, phone, WhatsApp number, emails, map location, social profiles.
6. Photography plan (shoot brief available on request) or approval for clearly-labelled temporary imagery.
7. Domain status (rockfordacademy.com / .lk), hosting and email provider choice.
8. Data retention periods for applications and enquiries; privacy-policy owner.
9. Approved testimonials with written consent (when available).
10. Leadership profiles for About Us (when available).

---

## 9. Phase plan

1. **Architecture, design system, homepage concept** ← *this delivery*
2. Homepage approval & revisions
3. WordPress theme + `rockford-core`: all public pages, CPTs, Site Settings
4. Recruitment system, enquiries, security hardening, technical SEO & analytics
5. Testing (responsive, WCAG 2.2 AA, Lighthouse/CWV on real devices, forms, email deliverability, admin workflows) → handover docs, backup/restore guide
