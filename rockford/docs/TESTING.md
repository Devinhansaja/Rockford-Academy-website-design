# Testing report

**Date:** 16 November 2026 · **Environment:** Windows 11, Node.js 24.20, local (`127.0.0.1`), email transport `outbox` plus a local fake SMTP server.

## Automated tests: `npm test` → 26 / 26 pass

| Suite | Covers |
|---|---|
| `tests/public.test.js` (6) | Every public page returns 200; unknown, draft and missing items return 404. Drafts and expired vacancies are hidden. Testimonials without consent are hidden. HTML is escaped. `javascript:` links are stripped from Markdown. JSON-LD (Course, JobPosting) is present. The sitemap excludes drafts and expired items. Security headers and CSP nonces are sent; path traversal is blocked. Enquiry form: time-trap, validation (422), honeypot (no storage), valid submission with reference, email normalised, retention date set. Job application: fake PDF and fake DOCX rejected by content check; valid PDF stored privately with a random name; CV not reachable by URL; CV download requires login; expired vacancy refuses applications. No personal data in the thank-you page or analytics hooks |
| `tests/admin.test.js` (18) | Sign-in required and `noindex` sent. Login: good, bad and safe redirect; lockout after 5 failures; TOTP 2FA enable, sign-in and disable. CSRF rejection. Programmes, vacancies, articles and testimonials CRUD with validation and quick actions. Testimonial consent rule. Media upload (rejects non-images). Settings save, validation and unknown keys ignored. Users and role enforcement (editor vs recruiter). Applications list, search, filters, status, CV download and delete. Enquiries. Password change, audit log, logout |
| `tests/mail.test.js` (1) | Built-in SMTP client completes a full SMTP conversation (EHLO, MAIL, RCPT, DATA with dot-stuffing, UTF-8 subject) |

## Manual checks (in the browser)
- Desktop (1440×900) and mobile (375×812): every public page loads with **no horizontal scrolling** and **no console errors**. Checked: Home, About, Our Approach, Programmes, programme detail, Careers, vacancy detail with application form, Contact, News, article, Privacy, Terms, Thank-you, 404.
- Homepage intro animation, word-by-word heading reveals, photo reveals and card carousel work, and all switch off under `prefers-reduced-motion`.
- Mobile menu: opens, traps focus, closes on Escape.
- Admin: signed in, dashboard checklist shows the honest "email not configured" and "SITE_URL not set" warnings, created and published a programme, confirmed it appears on `/programmes`. Settings and Applications screens checked; no console errors.
- Backup script: snapshot created with the database and CV files, and the snapshot database opens with the expected rows.
- Colour contrast of the palette (navy, white, gold, slate, steel blue) measured at WCAG AA or better for text.

## Responsive layout test (all public pages + admin screens)

| Width | Device class | Result |
|---|---|---|
| 320 px | Small phone | No horizontal overflow on any page. **Fixed:** large uppercase titles ("OPPORTUNITY.") overflowed at 38 px, so headings now scale with the screen width below 380 px |
| 375 px | Phone | No overflow; mobile menu works (focus trap, Escape) |
| 768 px | Tablet portrait | No overflow; hamburger menu. **Improved:** the hero photo is now landscape (16:10), so the headline appears on the first screen |
| 1024 px | Tablet landscape / small laptop | No overflow; hamburger menu (full navigation appears at 1100 px and up) |
| 1440 px | Laptop / desktop | No overflow; full navigation |
| 1920 px | Large monitor | No overflow; content width capped at 1320 px, hero full-bleed |

Admin dashboard, programme editor, settings and applications were checked at 320, 768, 1024 and 1920 px with no overflow.

## Server response times (local, 7 requests each, median)
All pages respond in about 6 to 16 ms (Windows timer resolution is about 15.6 ms). Page sizes before compression: homepage 25 KB, inner pages 5–12 KB, `main.css` 44 KB, `main.js` 8 KB. Enable gzip/zstd compression at the reverse proxy (`encode zstd gzip` in Caddy, see DEPLOY.md) to roughly quarter these over the network.

## Not yet tested (must be done on the live server)
- **Real email delivery** through Rockford's SMTP account (SPF, DKIM and DMARC alignment, inbox placement).
- **Lighthouse / Core Web Vitals** on the live HTTPS URL over mobile network throttling (targets: Performance ≥ 90, LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1). Fonts currently load from Google Fonts; self-hosting them is recommended for the best LCP.
- **Screen reader pass** (NVDA / VoiceOver) and a full WCAG 2.2 AA audit with real content.
- Real devices (Android and iOS Safari).
- Restore drill on the production host (BACKUP-RESTORE.md).
- Load test (not expected to be necessary at launch volumes).

Record the results of these checks in this file before final acceptance.
