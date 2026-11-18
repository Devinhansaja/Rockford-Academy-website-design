# Installation

## Requirements
- Node.js **22.13+** (Node 24 LTS recommended). Check with `node --version`.
- About 200 MB of disk space plus room for uploaded images, CVs and backups.
- Nothing else. No database server, PHP or `npm install` is needed.

## 1. Get the code onto the machine
Copy the `rockford` folder to the server, for example `/var/www/rockford`.

## 2. Configure
```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # paste into SESSION_SECRET
```
Edit `.env`:

| Setting | Meaning |
|---|---|
| `NODE_ENV` | `production` on the live server |
| `SITE_URL` | Public address, e.g. `https://rockfordacademy.com`. Used for canonical URLs, the sitemap and links in emails |
| `SESSION_SECRET` | Long random value (required in production) |
| `HOST`, `PORT` | Where Node listens. Keep `127.0.0.1` behind a reverse proxy |
| `TRUST_PROXY`, `COOKIE_SECURE` | `true` behind HTTPS reverse proxies |
| `DATA_DIR` | Database, CVs and backups. Must **not** be inside `public/` |
| `CV_MAX_MB`, `IMAGE_MAX_MB`, `FLYER_MAX_MB` | Upload size limits (CVs, images, job flyers) |
| `MAIL_TRANSPORT` | `outbox` (no delivery; saved to `storage/outbox`) or `smtp` |
| `MAIL_FROM`, `SMTP_*` | SMTP details from Google Workspace / Microsoft 365 / your email provider |

> Until `MAIL_TRANSPORT=smtp` is configured, forms still work and submissions are stored, but **no emails are sent**. The admin dashboard says so clearly.

## 3. Create the first administrator
```bash
npm run create-admin
# or non-interactively:
node scripts/create-admin.js --name "Jane Perera" --email jane@example.com --password "a-long-unique-passphrase-123"
```
Passwords need at least 12 characters with letters and numbers.

## 4. Start
```bash
npm start
```
Open `http://127.0.0.1:3000` for the site and `/admin` for the back office. For production, run it under a process manager (see DEPLOY.md).

## 5. First-time setup in the admin
1. **Website Settings → Contact:** enter only confirmed address, phone, WhatsApp, emails, map and social links.
2. **Website Settings → Notifications:** who receives enquiries and applications.
3. **Website Settings → Brand:** upload the approved logo in the Media Library, then paste its URL.
4. **Website Settings → Legal pages:** have the privacy policy and terms reviewed and replace the drafts.
5. **Website Settings → Images:** replace the temporary stock photos with Rockford photography (untick "temporary stock photo").
6. **Website Settings → Analytics:** add the GA4 measurement ID or GTM container ID, and the Search Console verification code.
7. **My account:** turn on two-factor authentication. Ask every admin and recruiter to do the same.
8. Add programmes and vacancies, then publish.

## Run the tests
```bash
npm test
```
