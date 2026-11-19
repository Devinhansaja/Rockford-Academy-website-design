# Rockford Academy website

*Beyond English. Beyond the Classroom.*

The Rockford Academy public website and its content-management / recruitment back office, in one small Node.js application.

- **No external dependencies.** It uses only Node.js built-ins (`node:http`, `node:sqlite`, `node:crypto`). There is no `npm install`, no build step and no third-party packages to keep patched.
- **Database:** a single SQLite file (`storage/rockford.db`).
- **Private files:** CVs are stored in `storage/cvs` and can only be downloaded through the authenticated admin.

## Quick start (local)

Requires **Node.js 22.13 or newer** (Node 24 LTS recommended).

```bash
cp .env.example .env        # optional for local use
npm run create-admin        # create your first administrator
npm start                   # http://127.0.0.1:3000  ·  admin at /admin
npm test                    # automated tests
```

## What's included

| Area | Where |
|---|---|
| Public pages | Home, About, Programmes (+ detail), Our Approach, Careers (+ vacancy detail and application form), Contact, News (+ article), Privacy, Terms, 404 |
| Forms | Enquiries (general and programme), job applications with CV upload, optional expression of interest |
| Admin (`/admin`) | Dashboard, programmes, vacancies, applications, enquiries, news, testimonials, media library, website settings (brand, contact, homepage copy, images, legal pages, analytics), users and roles, audit log, 2FA |
| SEO | Editable titles and descriptions, canonical URLs, Open Graph, `sitemap.xml`, `robots.txt`, JSON-LD (Organization, Course, JobPosting, Article, Breadcrumbs) |
| Analytics | GA4 or Google Tag Manager (only if configured). Events: `generate_lead`, `job_application_submitted`, `programme_interest`, `vacancy_view`, `whatsapp_click`, CTA clicks. No personal data is sent. |
| Security | CSP with nonces, CSRF tokens, scrypt passwords, login rate limiting and lockout, optional TOTP 2FA, role-based access, magic-byte file validation, private CV storage, automatic data retention |

## Documentation

- [docs/INSTALL.md](docs/INSTALL.md): installation and configuration
- [docs/DEPLOY.md](docs/DEPLOY.md): production deployment (server, HTTPS, process manager, DNS and email)
- [docs/BACKUP-RESTORE.md](docs/BACKUP-RESTORE.md): backups, restore and updates
- [docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md): handover guide for Rockford staff
- [docs/SECURITY.md](docs/SECURITY.md): security and privacy controls
- [docs/TESTING.md](docs/TESTING.md): test report
- [docs/BRIEF-CHECKLIST.md](docs/BRIEF-CHECKLIST.md): every requirement in the client brief, its status, platform rationale and future-expansion plan

## Docker / Coolify

`Dockerfile` (in this folder) builds a production image; set the build context / base directory to `rockford/`.
Mount persistent volumes at `/app/storage` (database, CVs, backups) and `/app/public/uploads` (images, flyers),
and set `SESSION_SECRET` and `SITE_URL`. Create the first admin inside the container with
`node scripts/create-admin.js --name "…" --email … --password "…"`.

### CI/CD

`.github/workflows/rockford-ci-cd.yml` runs the tests and a Docker build on every push and pull request.
A push to `main` that passes deploys through Coolify and then checks the live site. It needs the repository
secret `COOLIFY_TOKEN` (a Coolify API token limited to the "deploy" and "read" abilities).
