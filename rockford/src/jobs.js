'use strict';
/* Scheduled housekeeping: personal-data retention and session cleanup. Runs at start and hourly. */
const { q, now, audit } = require('./db');
const { deleteCv } = require('./uploads');
const { purgeExpiredSessions } = require('./security');

function purgeExpiredPersonalData() {
  const t = now();
  const apps = q.all('SELECT id, cv_file FROM applications WHERE retention_until < ?', t);
  for (const a of apps) { deleteCv(a.cv_file); q.run('DELETE FROM applications WHERE id = ?', a.id); }
  const enq = q.run('DELETE FROM enquiries WHERE retention_until < ?', t);
  if (apps.length || enq.changes) audit(null, 'retention.purge', `applications=${apps.length} enquiries=${enq.changes}`);
  return { applications: apps.length, enquiries: Number(enq.changes) };
}

function start() {
  const run = () => { try { purgeExpiredPersonalData(); purgeExpiredSessions(); } catch (e) { console.error('[jobs]', e); } };
  run();
  setInterval(run, 60 * 60 * 1000).unref();
}

module.exports = { start, purgeExpiredPersonalData };
