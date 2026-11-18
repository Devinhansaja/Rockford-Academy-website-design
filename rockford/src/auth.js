'use strict';
/*
 * Admin access control. Roles:
 *   admin      – everything, including settings and users
 *   editor     – programmes, articles, testimonials, media, homepage content, enquiries
 *   recruiter  – vacancies and job applications (incl. CV download)
 */
const security = require('./security');
const config = require('./config');

const CAN = {
  jobs: ['admin', 'recruiter'], // vacancies and job flyers
  content: ['admin', 'editor'],
  enquiries: ['admin', 'editor'],
  recruitment: ['admin', 'recruiter'], // job applications and CVs
  settings: ['admin'],
  users: ['admin'],
};

/*
 * ADMIN_SCOPE (see .env.example):
 *   jobs (default) – the admin manages ONLY vacancies and job flyers (add, publish, remove).
 *   full           – every admin section (programmes, news, applications, settings, users, …).
 */
const can = (session, area) => !!session && !session.pending_2fa
  && (config.adminScope === 'full' || area === 'jobs')
  && (CAN[area] || []).includes(session.role);

/** Middleware: require a fully signed-in user (2FA completed). */
function requireLogin(ctx) {
  const s = ctx.session;
  if (!s) { ctx.redirect('/admin/login?next=' + encodeURIComponent(ctx.path)); return false; }
  if (s.pending_2fa) { ctx.redirect('/admin/2fa'); return false; }
  return true;
}

/** Middleware factory: require one of the listed areas from CAN. */
const requireArea = (area) => (ctx) => {
  if (!requireLogin(ctx)) return false;
  if (!can(ctx.session, area)) { ctx.text('You do not have permission to view this page.', 403); return false; }
  return true;
};

/** Middleware for POST: validates the session CSRF token in field `_csrf`. Parses the body. */
const requireCsrf = (opts) => async (ctx) => {
  const { fields } = await ctx.body(opts);
  if (!security.verifyCsrf(ctx.session, fields._csrf)) { ctx.text('Your session has expired. Go back, refresh the page and try again.', 403); return false; }
  return true;
};

module.exports = { CAN, can, requireLogin, requireArea, requireCsrf };
