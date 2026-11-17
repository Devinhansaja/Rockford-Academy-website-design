# Backups, restore and updates

## What must be backed up
| Item | Location | Contains |
|---|---|---|
| Database | `storage/rockford.db` | All content, settings, users, applications, enquiries |
| CVs | `storage/cvs/` | Applicant CVs (personal data) |
| Images | `public/uploads/` | Images uploaded in the Media Library |
| Config | `.env` | Secrets. Store in a password manager, not with the backups |

## Daily automatic backup
`npm run backup` creates a consistent snapshot (SQLite `VACUUM INTO`, safe while the site runs) plus copies of CVs and uploads in `storage/backups/<timestamp>/`.

Schedule it nightly and keep 14 days (Linux cron, as the `rockford` user):
```cron
30 2 * * * cd /var/www/rockford && /usr/bin/node scripts/backup.js --keep 14 >> storage/backup.log 2>&1
```
**Copy backups off the server** (e.g. `rclone` or `restic` to encrypted cloud storage owned by Rockford). Backups contain personal data, so encrypt them and restrict access. Many hosts also offer daily server snapshots; enable them as a second layer.

## Restore
1. Stop the site: `sudo systemctl stop rockford`
2. Keep a copy of the current state: `mv storage/rockford.db storage/rockford.db.before-restore` (also remove any `rockford.db-wal` / `-shm` files)
3. Copy from the chosen backup folder:
   ```bash
   cp backups/<stamp>/rockford.db storage/rockford.db
   rsync -a --delete backups/<stamp>/cvs/ storage/cvs/
   rsync -a backups/<stamp>/uploads/ public/uploads/
   ```
4. Start: `sudo systemctl start rockford`, then check the homepage, `/admin` login and one application's CV download.

**Test a restore every quarter** on a separate machine or folder (`DATA_DIR=restore-test node server.js`).

## Updating the website software
1. Run a backup.
2. Replace the code (everything except `storage/`, `public/uploads/` and `.env`).
3. `npm test` (optional on the server), then `sudo systemctl restart rockford`. Database migrations run automatically at start-up.
4. Keep Node.js on a supported LTS version (`node --version`); update via your package manager and restart.
5. Keep the operating system patched (`unattended-upgrades` on Ubuntu).

Because there are no third-party npm packages, there are no dependency updates to track. Security updates come from Node.js and the OS.
