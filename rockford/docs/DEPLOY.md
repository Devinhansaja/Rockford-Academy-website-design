# Deployment

The site is a single Node.js process behind a reverse proxy that provides HTTPS. It needs a host that can run Node.js 22.13+: a small VPS (e.g. 1 vCPU / 1 GB RAM) or a Node-capable managed platform. Classic PHP-only shared hosting **cannot** run it.

> Rockford must own every account (domain registrar, hosting, DNS, email), registered with a Rockford-controlled email address and protected with 2FA. Developers should be added as users, not owners.

## Recommended setup (Ubuntu VPS)

### 1. Install Node.js and create a user
```bash
# Install Node 24 LTS from nodejs.org or NodeSource, then:
sudo adduser --system --group rockford
sudo mkdir -p /var/www/rockford && sudo chown rockford:rockford /var/www/rockford
# copy the project into /var/www/rockford, then create .env as in INSTALL.md
sudo -u rockford node /var/www/rockford/scripts/create-admin.js
```

### 2. Run as a service (systemd)
`/etc/systemd/system/rockford.service`:
```ini
[Unit]
Description=Rockford Academy website
After=network.target

[Service]
User=rockford
WorkingDirectory=/var/www/rockford
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=/var/www/rockford/storage /var/www/rockford/public/uploads

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now rockford
sudo journalctl -u rockford -f      # logs
```

### 3. HTTPS reverse proxy (Caddy, automatic certificates)
`/etc/caddy/Caddyfile`:
```
rockfordacademy.com, www.rockfordacademy.com {
    @www host www.rockfordacademy.com
    redir @www https://rockfordacademy.com{uri} permanent
    request_body { max_size 12MB }
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```
(Nginx works too: `proxy_pass http://127.0.0.1:3000;`, `client_max_body_size 12m;`, set `X-Forwarded-For`, and use Certbot for TLS.)

In `.env`: `TRUST_PROXY=true`, `COOKIE_SECURE=true`, `SITE_URL=https://rockfordacademy.com`.

### 4. Firewall
Allow only 22 (SSH, preferably key-only), 80 and 443. Port 3000 must not be public.

## Domain & DNS
- Register `rockfordacademy.com` (and optionally `rockford.lk` / `rockfordacademy.lk`, subject to availability) in Rockford's name, with auto-renew and registrar 2FA.
- `A`/`AAAA` records for the root and `www` → server IP.
- Redirect the secondary domains to the primary with 301s.

## Professional email (Google Workspace or Microsoft 365)
1. Add the provider's **MX** records.
2. **SPF** (TXT on root), e.g. Google: `v=spf1 include:_spf.google.com ~all`; Microsoft: `v=spf1 include:spf.protection.outlook.com -all`.
3. **DKIM:** generate the key in the provider's admin console and publish the TXT/CNAME record it gives you.
4. **DMARC:** start with `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:dmarc@rockfordacademy.com`, then move to `p=quarantine` once reports are clean.
5. Create addresses or aliases: `info@`, `careers@`, `admissions@`, `management@`.
6. For website email, create a sending account (or SMTP relay) and set in `.env`:
   - Google Workspace: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=no-reply@…`, `SMTP_PASS=<app password>`
   - Microsoft 365: `SMTP_HOST=smtp.office365.com`, `SMTP_PORT=587` (SMTP AUTH must be enabled for that mailbox)
   - Then `MAIL_TRANSPORT=smtp` and restart. Submit a test enquiry and confirm it arrives. The admin dashboard warning disappears once delivery is configured.

## Search & analytics
- Google Search Console: add the domain property, paste the verification code into **Settings → Analytics & SEO**, then submit `https://rockfordacademy.com/sitemap.xml`.
- GA4: create a property and paste the `G-…` ID (or a `GTM-…` container ID) into Settings. Mark `generate_lead` and `job_application_submitted` as key events.
- The Content-Security-Policy automatically allows Google's analytics hosts only when an ID is set.

## Go-live checklist
- [ ] `.env` production values set; `SESSION_SECRET` is unique
- [ ] HTTPS works; `http://` and `www.` redirect
- [ ] Admin users created, each with 2FA
- [ ] Contact details, notifications, legal pages and images updated (dashboard checklist is clear)
- [ ] Test enquiry and test application received by email, then deleted from the admin
- [ ] Nightly backup scheduled and a restore tested (BACKUP-RESTORE.md)
- [ ] Lighthouse/PageSpeed run on the live URL (mobile) and results recorded in TESTING.md
