# Security and privacy controls

| Control | Implementation |
|---|---|
| HTTPS | Terminated by the reverse proxy (DEPLOY.md). `COOKIE_SECURE=true` adds `Secure` cookies and HSTS |
| Security headers | Per-request Content-Security-Policy with script nonces (no inline scripts or `javascript:` URLs), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, strict referrer policy, Permissions-Policy, COOP |
| Authentication | Passwords hashed with scrypt (N=16384). Minimum 12 characters with letters and numbers |
| Login protection | Rate limit per IP and email, account lock for 15 minutes after 5 failed attempts, generic error messages |
| Two-factor authentication | Optional TOTP (Google Authenticator, Microsoft Authenticator, 1Password…) per user; dashboard warns about admins without it |
| Sessions | Random 256-bit IDs stored server-side, `HttpOnly`, `SameSite=Lax`, 8-hour expiry, deleted on logout |
| Authorisation | Roles: **admin** (everything), **editor** (content and enquiries), **recruiter** (vacancies and applications). Checked on every admin route |
| CSRF | Per-session token on every admin form; signed time-limited token on public forms |
| Injection | All SQL uses prepared statements; all output is HTML-escaped; staff Markdown is escaped first and only safe links (`http(s)`, `mailto`, `tel`, relative) are allowed |
| Spam | Honeypot field, signed minimum-time token (blocks instant bot submissions), per-IP rate limits |
| File uploads | Size limits; type checked by **extension and file content** (PDF/DOCX magic bytes; macro-enabled Word files rejected; images must be real JPG/PNG/WebP); random file names |
| CV privacy | CVs live in `storage/cvs` (outside the web root), are never linked publicly, are downloadable only by admin/recruiter accounts with `Content-Disposition: attachment` and `nosniff`, and every download is audit-logged. Notification emails never attach CVs |
| Data retention | Applications and enquiries carry a `retention_until` date (configurable, default 365 days) and are deleted automatically, CV files included, by an hourly job. Staff can delete earlier on request |
| Analytics | Event names and non-personal parameters only. No names, emails, phone numbers or CV content are sent |
| Audit log | Logins, content changes, settings changes, user changes, CV downloads and deletions |
| Backups | Nightly consistent snapshots; must be encrypted and stored off-server (BACKUP-RESTORE.md) |

## Sri Lanka Personal Data Protection Act (PDPA, No. 9 of 2022)
The site is built to support PDPA-aligned practice (purpose limitation, data minimisation, retention limits, access control, security safeguards, deletion on request). Rockford Academy remains the controller and should:
- appoint a person responsible for data protection,
- have the privacy policy reviewed and published (the bundled text is a draft),
- set retention periods that match its policy,
- handle access, correction and deletion requests using the admin (search by name or email, then delete).

## Reporting a vulnerability
Email the website administrator listed in the Admin Guide. Do not test against the live site without written permission.
