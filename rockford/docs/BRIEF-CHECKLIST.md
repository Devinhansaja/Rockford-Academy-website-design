# Brief compliance checklist

Checked against *Rockford Website Development & Brand Direction Brief* (initial strategic and functional brief). ✅ = built and tested · 🟡 = built, needs Rockford's content or a decision · ⏳ = done at go-live on the real server.

## 1. Brand positioning and strategic context
| Requirement | Status | Where |
|---|---|---|
| Purpose: prepare young people in Sri Lanka to recognise, pursue and use opportunities | ✅ | About hero, homepage |
| Vision and mission (exact wording) | ✅ | About → Vision / Mission cards |
| Initial target audience | ✅ | About → Who we serve (/Now) |
| Future audiences (adults, professionals, corporate teams) | ✅ | About → Who we serve (/Next) |
| Positioning: not just a spoken-English / tuition / IT class; English as a tool | ✅ | About → Educational philosophy |
| Proposed brand promise | ✅ | About → "Our promise" |

## 2. Objectives and initial learning areas
| Requirement | Status | Where |
|---|---|---|
| Credible, professional, forward-thinking presentation | ✅ | Whole site |
| Vision, mission, philosophy communicated | ✅ | About, Our Approach |
| Attract teachers, trainers, academic staff and other employees | ✅ | Careers page, homepage careers, announcement bar, "We're building our team" CTA |
| Platform for enquiries, registrations, content and programme expansion | ✅ | Enquiry forms, programmes CMS, news, see §8 |
| Six development areas (brief wording) presented as **areas, not courses** | ✅ | Homepage "What we develop", Programmes, About |
| Core message | ✅ | Homepage hero sub-headline |

## 3. Brand identity and visual direction
| Requirement | Status | Where |
|---|---|---|
| Modern, premium, youthful, internationally competitive; not a tuition-class look | ✅ | Approved reference-video layout |
| Colours: deep navy / white & light grey / warm gold | ✅ | Exact brief colours (`main.css` tokens) |
| Final colours to complement the approved logo | 🟡 | Upload the logo (Settings → Brand); adjust tokens if needed |
| Subtle animation, not excessive effects | ✅ | Motion layer, all off for reduced-motion users |
| Authentic photography; temporary images replaceable | 🟡 | Stock photos labelled "Illustrative photo"; replace via Media Library → Settings → Images |

## 4. Pages
| Page | Status |
|---|---|
| Home (hero, introduction, philosophy, development areas, programmes, why Rockford, environment, testimonials when available, careers, contact, CTAs) | ✅ |
| About Us (story, vision, mission, reason, philosophy, youth development, difference) | ✅ |
| Our Programmes (areas + summaries; add/remove/edit courses, ages, schedules, descriptions in admin) | ✅ |
| Our Approach (practical learning, discussions, presentations, public speaking, scenarios, personal development, confidence) | ✅ |
| Careers (why Rockford, vision, environment, vacancies, descriptions, requirements, how to apply, CV upload form) | ✅ |
| Contact (location + map, telephone, WhatsApp, email, social, enquiry form) | 🟡 Built; details appear once entered in Settings → Contact |
| Primary CTAs: Explore Our Programmes · Join Our Team · Get in Touch | ✅ |
| Careers ready before courses are finalised | ✅ (works with zero programmes) |

## 5. Homepage sections
01 Hero ✅ · 02 Our Purpose ✅ · 03 What We Develop ✅ · 04 Our Difference ✅ · 05 Our Programmes ✅ · 06 Our Environment ✅ · 07 Careers ✅ · 08 Contact ✅ (details, map and WhatsApp show once configured) · Headlines and CTAs editable, no text in images ✅ (Settings → Homepage copy)

## 6. Functional, technical and SEO
| Requirement | Status |
|---|---|
| Responsive (mobile, tablet, desktop) | ✅ Tested at 320–1920 px |
| Fast, mobile-optimised, optimised images | ✅ ~16 ms server time, small pages, responsive `srcset`, lazy loading · ⏳ PageSpeed on live URL |
| Accessible typography, contrast, CTAs | ✅ AA contrast, labels, focus styles, reduced motion |
| CMS ("WordPress preferred, or another widely supported CMS with a clear reason") | ✅ Custom CMS at the client's instruction; rationale below |
| Staff access; edit text, photos, pages, contact details without a developer | ✅ Admin with roles |
| Publish/update **courses, announcements, articles, vacancies** | ✅ Programmes, **Announcement bar**, News, Vacancies |
| Enquiry forms with email notifications | ✅ ⏳ Email delivery needs SMTP credentials |
| WhatsApp integration | ✅ Footer, contact, homepage (needs number) |
| CV upload and vacancy application form | ✅ |
| Spam protection and secure handling of personal data | ✅ |
| Add, close and archive vacancies | ✅ |
| SEO-friendly URLs; editable titles and descriptions | ✅ |
| Logical headings; descriptive alt text | ✅ |
| XML sitemap and robots.txt | ✅ |
| Search Console and GA4; GTM compatibility | ✅ Settings → Analytics (IDs) · ⏳ verify on live domain |
| Organisation, local business and course structured data | ✅ EducationalOrganization (+ LocalBusiness when an address is set), Course, JobPosting, Article |
| Local SEO: consistent name, address, contact | ✅ One source (Settings → Contact) feeds footer, contact page, homepage and schema |
| Keyword themes used naturally | ✅ Meta descriptions and page copy (English academy in Sri Lanka, spoken English, communication skills training, personality development, confidence building) |

## 7. Domain, hosting and email
| Requirement | Status |
|---|---|
| Rockford owns domain, hosting, CMS and email | ⏳ DEPLOY.md, owner checklist |
| rockfordacademy.com (+ .lk options), registered to Rockford, auto-renew, 2FA | ⏳ DEPLOY.md |
| Hosting: SSL, daily backups + restore, security monitoring | ✅ Backup script + restore guide · ⏳ host choice |
| Google Workspace / Microsoft 365, MX, SPF, DKIM, DMARC | ⏳ DEPLOY.md step-by-step |
| info@, careers@, admissions@, management@ | ⏳ DEPLOY.md; addresses entered in Settings → Contact / Notifications |

## 8. Future scalability (not built now, no rebuild needed later)
| Future need | How the platform supports it |
|---|---|
| Adult conversational English programmes | Programmes already have audience / age-group / category fields |
| Professional development and corporate training | New programme categories; Contact form already has "Partnerships and organisations" |
| Online learning resources and articles | News & Articles module (categories, images, Markdown) |
| Student registration, applications, online payments | Add a `registrations` table plus a payment provider (e.g. PayHere / Stripe) behind the existing form and CSRF framework |
| Student portal / LMS | Users and roles already exist; add a `student` role and protected `/portal` routes, or integrate an external LMS via SSO |
| Achievements, testimonials, success stories | Testimonials module with consent rule (live) |
| Events, workshops, partnerships | Add an `events` table re-using the vacancy/programme CRUD pattern; homepage card styles already exist |
| Multilingual (Sinhala / Tamil) | All copy is server-rendered from settings/database, so translated fields can be added per language |

**Platform limitations to know:** needs Node.js hosting (not cPanel/PHP shared hosting); no plugin marketplace, so new features are developed rather than installed; one server process (more than enough for launch traffic).

## 9. References
EF, Lingoda, British Council and Toastmasters were used for direction only. Layout follows the client-selected reference video; no layouts, text or assets were copied.

## 10. Deliverables and approval gates
| Deliverable | Status |
|---|---|
| Recommended platform and rationale | ✅ Below |
| Sitemap, navigation, homepage mock-up | ✅ `docs/01-architecture-and-design-system.md`, approved homepage |
| Domain, hosting and email recommendations | ✅ DEPLOY.md |
| Responsive website with agreed pages | ✅ |
| Editable CMS and admin access | ✅ |
| Contact form, WhatsApp, recruitment and CV submission | ✅ |
| Basic SEO and analytics | ✅ |
| Security, backup and maintenance | ✅ SECURITY.md, BACKUP-RESTORE.md |
| Training, handover documentation and credentials | ✅ ADMIN-GUIDE.md · ⏳ credentials handed over at go-live (never stored in the code) |
| Approval gates (domain, design, layouts, staging review, form/email/analytics tests, admin handover) | ⏳ DEPLOY.md go-live checklist + TESTING.md |

## Platform rationale
The brief prefers WordPress "or another widely supported CMS with a clear reason". At Rockford's instruction the site is a custom Node.js application because:
1. **Exact design fidelity.** The approved reference layout and animations are implemented directly, with no theme or page-builder limits.
2. **Security and maintenance.** There are no plugins or third-party packages to patch; the attack surface is small, and CVs are private by design.
3. **Speed.** Small server-rendered pages respond in milliseconds, which suits mobile users in Sri Lanka.
4. **Built for this brief.** Recruitment, data retention, consent rules and honest empty states are part of the core, not add-ons.
5. **Portability.** Node.js runs on any VPS or cloud host; content lives in one SQLite file that is easy to back up and move.

Trade-off: routine content is fully editable by staff, but new *features* need a developer (there is no plugin marketplace).

## Still needed from Rockford
Approved logo · real photographs · confirmed address, phone, WhatsApp, emails, map and social links · first programmes · first vacancies · legal review of privacy policy and terms · domain, hosting and email accounts in Rockford's name · approval of the Discover → Develop → Practise → Transform framework · approved testimonials with consent (when available).
