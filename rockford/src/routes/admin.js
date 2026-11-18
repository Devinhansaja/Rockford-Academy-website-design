'use strict';
/*
 * Admin panel (CMS + recruitment back office). Every route lives under /admin, sends
 * X-Robots-Tag: noindex, requires a signed-in user with the right role, and every POST
 * checks the session CSRF token. Form definitions live in ./admin-schema.js, templates in
 * ../views/admin/.
 */
const fs = require('node:fs');
const config = require('../config');
const { q, now, audit, uniqueSlug } = require('../db');
const security = require('../security');
const { can, requireLogin, requireArea, requireCsrf } = require('../auth');
const settings = require('../settings');
const uploads = require('../uploads');
const mail = require('../mail');
const { parseCookies } = require('../http');
const schema = require('./admin-schema');
const ui = require('../views/admin/ui');
const { layout } = require('../views/admin/layout');
const authViews = require('../views/admin/auth');
const crudViews = require('../views/admin/crud');
const inbox = require('../views/admin/inbox');
const dashViews = require('../views/admin/dashboard');
const mediaViews = require('../views/admin/media');
const flyerViews = require('../views/admin/flyers');
const settingsViews = require('../views/admin/settings');
const userViews = require('../views/admin/users');

const MIN = 60 * 1000;
const FORM_LIMIT = 512 * 1024;
const PAGE_SIZE = 25;
const ROLES = ['admin', 'editor', 'recruiter'];

const noindex = (ctx) => { ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow'); return true; };
const csrf = requireCsrf({ limit: FORM_LIMIT });
const fieldsOf = async (ctx) => (await ctx.body({ limit: FORM_LIMIT })).fields;
const hasErrors = (e) => Object.keys(e).length > 0;

function notFound(ctx, msg = 'That item does not exist or has been deleted.') {
  ctx.html(layout(ctx, { title: 'Not found', body: `${ui.pageHeader('Not found')}<p>${security.h(msg)}</p><p><a href="/admin">Back to the dashboard</a></p>` }), 404);
  return false;
}

/** Middleware: load `table` row by numeric :id into ctx.row (404 otherwise). */
const loadRow = (table) => (ctx) => {
  const id = /^\d{1,12}$/.test(ctx.params.id) ? Number(ctx.params.id) : 0;
  const row = id ? q.get(`SELECT * FROM ${table} WHERE id = ?`, id) : null;
  if (!row) return notFound(ctx);
  ctx.row = row;
  return true;
};

/** Only allow redirects back into the admin. */
function safeNext(next) {
  const n = String(next || '');
  return /^\/admin(\/[A-Za-z0-9_\-/]*)?(\?[A-Za-z0-9_=&%-]*)?$/.test(n) && !n.startsWith('/admin/login') && !n.startsWith('/admin/logout') ? n : '/admin';
}

/* Login throttling: failed attempts per IP+email (in memory) plus a coarse per-IP limit. */
const loginFailures = new Map();
const LOGIN_WINDOW = 15 * MIN;
function loginBlocked(key) {
  const b = loginFailures.get(key);
  if (!b) return false;
  if (b.reset < Date.now()) { loginFailures.delete(key); return false; }
  return b.count >= 5;
}
function recordLoginFailure(key) {
  const b = loginFailures.get(key);
  if (!b || b.reset < Date.now()) loginFailures.set(key, { count: 1, reset: Date.now() + LOGIN_WINDOW });
  else b.count += 1;
}
setInterval(() => { const t = Date.now(); for (const [k, b] of loginFailures) if (b.reset < t) loginFailures.delete(k); }, 5 * MIN).unref();
let dummyHash = null; // used to keep timing similar for unknown emails
const LOGIN_ERROR = 'Email or password is incorrect, or the account is temporarily locked after too many attempts. Please try again later or ask an administrator for help.';

function register(app) {
  const get = (p, ...hs) => app.router.get(p, noindex, ...hs);
  const post = (p, ...hs) => app.router.post(p, noindex, ...hs);

  /* ── Sign in / 2FA / sign out ──────────────────────────────── */
  get('/admin/login', (ctx) => {
    const s = ctx.session;
    if (s && !s.pending_2fa) return ctx.redirect(safeNext(ctx.query.next));
    ctx.html(authViews.loginPage(ctx, { token: security.formToken(), next: safeNext(ctx.query.next) }));
  });

  post('/admin/login', async (ctx) => {
    const f = (await ctx.body({ limit: 16 * 1024 })).fields;
    const email = schema.str(f.email).toLowerCase().slice(0, 200);
    const password = typeof f.password === 'string' ? f.password.slice(0, 1000) : '';
    const next = safeNext(f.next);
    const fail = (msg, status) => ctx.html(authViews.loginPage(ctx, { email, error: msg, token: security.formToken(), next }), status);
    if (security.checkFormToken(f._token, { minMs: 0, maxMs: 8 * 60 * MIN })) return fail('The sign-in form expired. Please try again.', 400);
    if (!email || !password) return fail('Enter your email address and password.', 400);

    const key = `${ctx.ip}|${email}`;
    if (loginBlocked(key) || !security.rateLimit(`admin-login-ip:${ctx.ip}`, 50, LOGIN_WINDOW)) return fail(LOGIN_ERROR, 429);

    const user = q.get('SELECT * FROM users WHERE email = ?', email);
    let ok = false;
    if (user) ok = security.verifyPassword(password, user.pass_hash);
    else { dummyHash ||= security.hashPassword('not-a-real-password-0'); security.verifyPassword(password, dummyHash); }
    const locked = user && user.locked_until && user.locked_until > now();

    if (!ok || locked) {
      recordLoginFailure(key);
      if (user && !locked) {
        const failed = user.failed_logins + 1;
        if (failed >= 5) {
          q.run('UPDATE users SET failed_logins = 0, locked_until = ? WHERE id = ?', now() + LOGIN_WINDOW, user.id);
          audit(user.id, 'login.locked', `Account locked for 15 minutes after 5 failed sign-ins from ${ctx.ip}`);
        } else q.run('UPDATE users SET failed_logins = ? WHERE id = ?', failed, user.id);
      }
      return fail(LOGIN_ERROR, 401);
    }

    q.run('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?', now(), user.id);
    const old = parseCookies(ctx.req).rf_session;
    if (old) q.run('DELETE FROM sessions WHERE id = ?', old);
    const pending = !!user.totp_secret;
    security.createSession(ctx.res, user.id, { pending2fa: pending });
    audit(user.id, pending ? 'login.password_ok' : 'login', `from ${ctx.ip}`);
    if (pending) return ctx.redirect('/admin/2fa' + (next !== '/admin' ? `?next=${encodeURIComponent(next)}` : ''));
    ctx.redirect(next);
  });

  get('/admin/2fa', (ctx) => {
    const s = ctx.session;
    if (!s) return ctx.redirect('/admin/login');
    if (!s.pending_2fa) return ctx.redirect('/admin');
    ctx.html(authViews.twofaPage(ctx, { next: safeNext(ctx.query.next) }));
  });

  post('/admin/2fa', (ctx) => {
    if (!ctx.session) { ctx.redirect('/admin/login'); return false; }
    return true;
  }, csrf, async (ctx) => {
    const s = ctx.session;
    if (!s.pending_2fa) return ctx.redirect('/admin');
    const f = await fieldsOf(ctx);
    const next = safeNext(f.next);
    if (security.verifyTotp(s.totp_secret, f.code)) {
      q.run('UPDATE sessions SET pending_2fa = 0 WHERE id = ?', s.id);
      audit(s.user_id, 'login', `with two-factor code from ${ctx.ip}`);
      return ctx.redirect(next);
    }
    if (!security.rateLimit(`admin-2fa:${s.id}`, 5, LOGIN_WINDOW)) {
      security.destroySession(ctx.req, ctx.res);
      audit(s.user_id, 'login.2fa_failed', 'Too many wrong codes; signed out');
      return ctx.redirect('/admin/login');
    }
    ctx.html(authViews.twofaPage(ctx, { error: 'That code is not correct. Check your app and try again (codes change every 30 seconds).', next }), 401);
  });

  post('/admin/logout', async (ctx) => {
    if (ctx.session) {
      const f = await fieldsOf(ctx);
      if (!security.verifyCsrf(ctx.session, f._csrf)) return ctx.text('Your session has expired. Go back, refresh the page and try again.', 403);
      audit(ctx.session.user_id, 'logout');
    }
    security.destroySession(ctx.req, ctx.res);
    ctx.redirect('/admin/login?loggedout=1');
  });

  /* ── Dashboard ─────────────────────────────────────────────── */
  get('/admin', requireLogin, (ctx) => {
    const s = ctx.session;
    const n = (sql, ...p) => q.get(sql, ...p).n;
    const counts = [];
    if (can(s, 'recruitment')) counts.push({ label: 'New applications', value: n("SELECT COUNT(*) AS n FROM applications WHERE status = 'received'"), href: '/admin/applications?status=received' });
    if (can(s, 'jobs')) {
      counts.push({ label: 'Open vacancies', value: n("SELECT COUNT(*) AS n FROM vacancies WHERE status = 'open'"), href: '/admin/vacancies' });
      counts.push({ label: 'Published job flyers', value: n("SELECT COUNT(*) AS n FROM flyers WHERE status = 'published'"), href: '/admin/flyers' });
    }
    if (can(s, 'enquiries')) counts.push({ label: 'New enquiries', value: n("SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'"), href: '/admin/enquiries?status=new' });
    if (can(s, 'content')) {
      counts.push({ label: 'Published programmes', value: n("SELECT COUNT(*) AS n FROM programmes WHERE status = 'published'"), href: '/admin/programmes' });
      counts.push({ label: 'Published articles', value: n("SELECT COUNT(*) AS n FROM articles WHERE status = 'published'"), href: '/admin/articles' });
    }

    const st = settings.all();
    const checklist = [];
    if (can(s, 'settings')) {
      if (!mail.configured()) checklist.push({ title: 'Email delivery is not configured', text: 'Enquiries and job applications are saved here in the admin, but they are NOT emailed to anyone. Ask your developer to set up SMTP in the server .env file (MAIL_TRANSPORT=smtp). Until then, check this admin regularly.' });
      if (!config.siteUrl) checklist.push({ title: 'SITE_URL is not set', text: 'Set SITE_URL in the server .env file (for example https://www.rockfordacademy.lk) so search engines, the sitemap and social previews use the correct address.' });
      if (!st.contact_email && !st.contact_phone && !st.contact_address) checklist.push({ title: 'No contact details', text: 'The website shows no address, phone number or email address yet. Add the confirmed details.', href: '/admin/settings/contact', link: 'Add contact details' });
      if (!st.notify_enquiries_to || !st.notify_applications_to) checklist.push({ title: 'Notification recipients are missing', text: 'Choose who should be notified about new enquiries and job applications.', href: '/admin/settings/notifications', link: 'Set recipients' });
    }
    if (can(s, 'content')) {
      if (/Draft for review/i.test(st.legal_privacy) || /Draft for review/i.test(st.legal_terms)) checklist.push({ title: 'Legal pages are still drafts', text: 'The privacy policy and terms must be reviewed by Rockford’s legal or privacy owner before launch.', href: '/admin/settings/legal', link: 'Review legal pages' });
      const im = st.images || {};
      const stock = Object.entries(im).filter(([k, v]) => k !== 'gallery' && v && v.stock).length + (Array.isArray(im.gallery) ? im.gallery.filter((g) => g && g.stock).length : 0);
      if (stock) checklist.push({ title: `${stock} temporary stock photo${stock === 1 ? '' : 's'} still in use`, text: 'Replace them with real photos of Rockford people and spaces when available.', href: '/admin/settings/images', link: 'Manage images' });
    }
    if (can(s, 'users')) {
      const no2fa = q.all("SELECT name FROM users WHERE role = 'admin' AND totp_secret IS NULL ORDER BY name");
      if (no2fa.length) checklist.push({ title: `${no2fa.length} administrator${no2fa.length === 1 ? ' has' : 's have'} not turned on two-factor authentication`, text: `${no2fa.map((u) => u.name).join(', ')}. Each administrator can turn it on from My account.`, href: '/admin/account', link: 'Set up 2FA' });
    }
    ctx.html(dashViews.dashboard(ctx, { counts, checklist, showChecklist: can(s, 'settings') || can(s, 'content') || can(s, 'users') }));
  });

  /* ── My account ────────────────────────────────────────────── */
  get('/admin/account', requireLogin, (ctx) => ctx.html(authViews.accountPage(ctx)));

  post('/admin/account/password', requireLogin, csrf, async (ctx) => {
    const s = ctx.session; const f = await fieldsOf(ctx);
    const cur = typeof f.current_password === 'string' ? f.current_password : '';
    const pw = typeof f.new_password === 'string' ? f.new_password : '';
    const errors = {};
    const user = q.get('SELECT pass_hash FROM users WHERE id = ?', s.user_id);
    if (!cur || !security.verifyPassword(cur, user.pass_hash)) errors.current_password = 'Your current password is not correct.';
    const p = security.passwordProblem(pw);
    if (p) errors.new_password = `New password: ${p}`;
    else if (pw !== f.confirm_password) errors.confirm_password = 'The two new passwords do not match.';
    if (hasErrors(errors)) return ctx.html(authViews.accountPage(ctx, { pwErrors: errors }), 422);
    q.run('UPDATE users SET pass_hash = ? WHERE id = ?', security.hashPassword(pw), s.user_id);
    q.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', s.user_id, s.id);
    audit(s.user_id, 'account.password', 'Changed own password; other sessions signed out');
    ctx.redirect('/admin/account?password=1');
  });

  get('/admin/account/2fa', requireLogin, (ctx) => {
    const s = ctx.session;
    if (s.totp_secret) return ctx.redirect('/admin/account');
    const secret = security.newTotpSecret();
    ctx.html(authViews.accountPage(ctx, { setup: { secret, uri: security.totpUri(secret, s.email) } }));
  });

  post('/admin/account/2fa', requireLogin, csrf, async (ctx) => {
    const s = ctx.session; const f = await fieldsOf(ctx);
    if (s.totp_secret) return ctx.redirect('/admin/account');
    const secret = schema.str(f.secret);
    if (!/^[A-Z2-7]{32}$/.test(secret)) return ctx.redirect('/admin/account/2fa');
    if (!security.verifyTotp(secret, f.code)) {
      return ctx.html(authViews.accountPage(ctx, { setup: { secret, uri: security.totpUri(secret, s.email) }, setupError: 'That code did not match. Check the key was entered correctly and that your phone’s clock is set automatically, then try the newest code.' }), 422);
    }
    q.run('UPDATE users SET totp_secret = ? WHERE id = ?', secret, s.user_id);
    audit(s.user_id, 'account.2fa_on');
    ctx.redirect('/admin/account?twofa_on=1');
  });

  post('/admin/account/2fa/disable', requireLogin, csrf, async (ctx) => {
    const s = ctx.session; const f = await fieldsOf(ctx);
    const user = q.get('SELECT pass_hash FROM users WHERE id = ?', s.user_id);
    if (typeof f.disable_password !== 'string' || !security.verifyPassword(f.disable_password, user.pass_hash)) {
      return ctx.html(authViews.accountPage(ctx, { disableError: 'Your password is not correct.' }), 422);
    }
    q.run('UPDATE users SET totp_secret = NULL WHERE id = ?', s.user_id);
    audit(s.user_id, 'account.2fa_off');
    ctx.redirect('/admin/account?twofa_off=1');
  });

  /* ── Generic content types ─────────────────────────────────── */
  for (const def of schema.ENTITIES) registerCrud(def);

  function quickButtons(def, row, s, small) {
    return Object.keys(def.quick).filter((to) => to !== row.status).map((to) => {
      const label = def.quickLabel ? def.quickLabel(row.status, to) : def.quick[to];
      return ui.actionForm(`/admin/${def.key}/${row.id}/status`, label, s, {
        hidden: { status: to }, cls: `btn${small ? ' btn-small' : ''}`,
        confirm: to === 'archived' ? 'Archive this vacancy? It will be hidden from the website.' : undefined,
      });
    }).join(' ');
  }

  function registerCrud(def) {
    const area = requireArea(def.area);
    const base = `/admin/${def.key}`;
    const nameOf = (r) => r.title || r.name;
    def.listActions = (r, s) => `<div class="row-actions">${quickButtons(def, r, s, true)}</div>`;
    def.aside = (row, s) => {
      let extra = '';
      if (def.key === 'vacancies') {
        const c = q.get('SELECT COUNT(*) AS n FROM applications WHERE vacancy_id = ?', row.id).n;
        extra = can(s, 'recruitment') ? `<p><a href="/admin/applications?vacancy=${row.id}">${c} application${c === 1 ? '' : 's'}</a></p>` : '';
      }
      return `<div class="panel"><h2>Status</h2><p>Currently ${ui.statusBadge(row.status)}</p>${extra}<div class="button-row">${quickButtons(def, row, s)}</div></div>`;
    };

    const render = (ctx, opts, status) => ctx.html(crudViews.formPage(ctx, def, opts), status);

    async function save(ctx, row) {
      const form = schema.readForm(def.fields, await fieldsOf(ctx));
      const errors = schema.validateFields(def.fields, form, {});
      for (const v of def.validate || []) v(form, errors, row);
      const data = schema.toDb(def, form);
      if (def.slug && !errors.title && !form.slug) data.slug = uniqueSlug(def.table, form.title, row ? row.id : undefined);
      if (def.beforeSave) def.beforeSave(data, row);
      const pub = def.publishProblem && def.publishProblem(data);
      if (pub && !errors.status) errors.status = pub;
      if (hasErrors(errors)) return render(ctx, { id: row && row.id, row, values: form, errors }, 422);

      data.updated_at = now();
      const cols = Object.keys(data);
      if (cols.some((c) => !/^[a-z_]+$/.test(c))) throw new Error('bad column');
      let id;
      if (row) {
        q.run(`UPDATE ${def.table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, ...cols.map((c) => data[c]), row.id);
        id = row.id;
      } else {
        data.created_at = data.updated_at; cols.push('created_at');
        id = Number(q.run(`INSERT INTO ${def.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...cols.map((c) => data[c])).lastInsertRowid);
      }
      audit(ctx.session.user_id, `${def.key}.${row ? 'update' : 'create'}`, `#${id} “${nameOf(data)}” (${data.status})`);
      ctx.redirect(`${base}/${id}?${row ? 'saved' : 'created'}=1`);
    }

    get(base, area, (ctx) => ctx.html(crudViews.listPage(ctx, def, q.all(def.listSql))));
    get(`${base}/new`, area, (ctx) => render(ctx, { values: { ...def.defaults } }));
    post(`${base}/new`, area, csrf, (ctx) => save(ctx, null));
    get(`${base}/:id`, area, loadRow(def.table), (ctx) => render(ctx, { id: ctx.row.id, row: ctx.row, values: schema.toForm(def, ctx.row) }));
    post(`${base}/:id`, area, csrf, loadRow(def.table), (ctx) => save(ctx, ctx.row));

    post(`${base}/:id/status`, area, csrf, loadRow(def.table), async (ctx) => {
      const row = ctx.row;
      const to = schema.str((await fieldsOf(ctx)).status);
      if (!Object.prototype.hasOwnProperty.call(def.quick, to)) return ctx.text('Unknown status', 400);
      const patch = { status: to };
      if (def.beforeSave) def.beforeSave(patch, row);
      const pub = def.publishProblem && def.publishProblem({ ...row, ...patch });
      if (pub) return render(ctx, { id: row.id, row, values: schema.toForm(def, row), errors: { status: pub } }, 422);
      patch.updated_at = now();
      const cols = Object.keys(patch);
      q.run(`UPDATE ${def.table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, ...cols.map((c) => patch[c]), row.id);
      audit(ctx.session.user_id, `${def.key}.status`, `#${row.id} “${nameOf(row)}” ${row.status} → ${to}`);
      const back = ctx.req.headers.referer && /\/admin\/[a-z]+\/\d+$/.test(new URL(ctx.req.headers.referer, 'http://x').pathname) ? `${base}/${row.id}` : base;
      ctx.redirect(`${back}?status=1`);
    });

    post(`${base}/:id/delete`, area, csrf, loadRow(def.table), (ctx) => {
      q.run(`DELETE FROM ${def.table} WHERE id = ?`, ctx.row.id);
      audit(ctx.session.user_id, `${def.key}.delete`, `#${ctx.row.id} “${nameOf(ctx.row)}”`);
      ctx.redirect(`${base}?deleted=1`);
    });
  }

  /* ── Applications ──────────────────────────────────────────── */
  const recruit = requireArea('recruitment');
  const jobs = requireArea('jobs');
  const likeEsc = (s) => `%${s.replace(/[\\%_]/g, (c) => '\\' + c)}%`;

  /**
   * Filtered, searched, paginated inbox list. `from` is "table alias [JOIN …]"; filter and search
   * column names are constants (never user input); all values are bound parameters.
   */
  function listQuery({ from, alias, select, src, filters, searchCols }) {
    const f = { q: schema.str(src.q).slice(0, 100), page: Math.max(1, parseInt(src.page, 10) || 1) };
    const where = []; const params = [];
    for (const [name, { column, test }] of Object.entries(filters)) {
      const v = schema.str(src[name]);
      f[name] = test(v) ? v : '';
      if (f[name]) { where.push(`${alias}.${column} = ?`); params.push(f[name]); }
    }
    if (f.q) { where.push(`(${searchCols.map((c) => `${alias}.${c} LIKE ? ESCAPE '\\'`).join(' OR ')})`); params.push(...searchCols.map(() => likeEsc(f.q))); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = q.get(`SELECT COUNT(*) AS n FROM ${from} ${w}`, ...params).n;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(f.page, pages);
    const rows = q.all(`SELECT ${select} FROM ${from} ${w} ORDER BY ${alias}.created_at DESC, ${alias}.id DESC LIMIT ? OFFSET ?`, ...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);
    return { rows, total, page, pages, f };
  }

  const appFilters = { vacancy: { column: 'vacancy_id', test: (v) => /^\d{1,12}$/.test(v) }, status: { column: 'status', test: (v) => inbox.APP_STATUSES.includes(v) } };
  function applicationsList(ctx, src) {
    const r = listQuery({ from: 'applications a', alias: 'a', select: 'a.id, a.ref, a.name, a.position, a.status, a.created_at', src, filters: appFilters, searchCols: ['ref', 'name', 'email', 'position'] });
    const vacancies = q.all("SELECT id, title, status FROM vacancies ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, title");
    ctx.html(inbox.applicationsList(ctx, { ...r, vacancies }));
  }
  get('/admin/applications', recruit, (ctx) => applicationsList(ctx, ctx.query));
  post('/admin/applications', recruit, csrf, async (ctx) => {
    const f = await fieldsOf(ctx);
    // Free-text searches are rendered directly so names/emails never appear in URLs.
    if (!schema.str(f.q)) {
      const p = new URLSearchParams();
      for (const k of ['vacancy', 'status', 'page']) { const v = schema.str(f[k]); if (v && /^[a-z0-9_]{1,20}$/.test(v)) p.set(k, v); }
      return ctx.redirect('/admin/applications' + (p.toString() ? `?${p}` : ''));
    }
    applicationsList(ctx, f);
  });

  const appDetail = (ctx, extra = {}, status) => {
    const a = ctx.row;
    const vacancy = a.vacancy_id ? q.get('SELECT id, title FROM vacancies WHERE id = ?', a.vacancy_id) : null;
    ctx.html(inbox.applicationDetail(ctx, { a, vacancy, ...extra }), status);
  };
  get('/admin/applications/:id', recruit, loadRow('applications'), (ctx) => appDetail(ctx));
  post('/admin/applications/:id', recruit, csrf, loadRow('applications'), async (ctx) => {
    const f = await fieldsOf(ctx); const a = ctx.row;
    const values = { status: schema.str(f.status), notes: schema.str(f.notes) };
    const errors = {};
    if (!inbox.APP_STATUSES.includes(values.status)) errors.status = 'Choose a valid status.';
    if (values.notes.length > 5000) errors.notes = 'Notes must be 5000 characters or fewer.';
    if (hasErrors(errors)) return appDetail(ctx, { errors, values }, 422);
    q.run('UPDATE applications SET status = ?, notes = ? WHERE id = ?', values.status, values.notes, a.id);
    audit(ctx.session.user_id, 'application.update', `${a.ref}: status ${a.status} → ${values.status}${values.notes !== a.notes ? ', notes edited' : ''}`);
    ctx.redirect(`/admin/applications/${a.id}?saved=1`);
  });

  get('/admin/applications/:id/cv', recruit, loadRow('applications'), (ctx) => {
    const a = ctx.row;
    const file = uploads.cvPath(a.cv_file);
    let st = null;
    try { st = file && fs.statSync(file); } catch { st = null; }
    if (!st || !st.isFile()) return notFound(ctx, 'The CV file for this application could not be found. It may have been deleted.');
    const ext = a.cv_file.endsWith('.pdf') ? '.pdf' : '.docx';
    const mime = ext === '.pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    let base = String(a.cv_name || 'cv').replace(/\.[^.]*$/, '').normalize('NFKD').replace(/[^A-Za-z0-9 ._()-]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'cv';
    if (base.startsWith('.')) base = '_' + base;
    const filename = `${base}${ext}`;
    audit(ctx.session.user_id, 'application.cv_download', `${a.ref}`);
    ctx.res.writeHead(200, {
      'Content-Type': a.cv_mime === mime ? a.cv_mime : mime,
      'Content-Length': st.size,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    if (ctx.req.method === 'HEAD') return ctx.res.end();
    fs.createReadStream(file).on('error', () => ctx.res.destroy()).pipe(ctx.res);
  });

  post('/admin/applications/:id/delete', recruit, csrf, loadRow('applications'), (ctx) => {
    const a = ctx.row;
    uploads.deleteCv(a.cv_file);
    q.run('DELETE FROM applications WHERE id = ?', a.id);
    audit(ctx.session.user_id, 'application.delete', `${a.ref} (${a.position})`);
    ctx.redirect('/admin/applications?deleted=1');
  });

  /* ── Job flyers (image, PDF or typed words) ────────────────── */
  const flyerMaxMb = Math.round(config.flyerMaxBytes / 1048576);
  const FLYER_FIELDS = [
    { name: 'kind', label: 'Flyer type', type: 'select', required: true, options: flyerViews.KINDS },
    { name: 'title', label: 'Title', required: true, maxlength: 150 },
    { name: 'summary', label: 'Short description', maxlength: 300 },
    { name: 'body', label: 'Flyer text', maxlength: 20000 },
    { name: 'alt', label: 'Image description', maxlength: 250 },
    { name: 'deadline', label: 'Closing date', type: 'date' },
    { name: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['published', 'Published']] },
    { name: 'sort', label: 'Sort order', type: 'number', min: -9999, max: 9999 },
  ];
  const flyerValues = (r) => ({ kind: r.kind, title: r.title, summary: r.summary, body: r.body, alt: r.alt, deadline: r.deadline, status: r.status, sort: String(r.sort) });
  const flyerPage = (ctx, row, values, errors, status) => ctx.html(flyerViews.formPage(ctx, { row, values, errors, maxMb: flyerMaxMb }), status);
  const flyerNew = { kind: 'image', status: 'draft', sort: '0' };

  /** Parse the (large) multipart body so an oversized file gets a friendly message. */
  const flyerBody = async (ctx) => {
    try { await ctx.body({ limit: config.flyerMaxBytes + 64 * 1024 }); return true; } catch (e) {
      if (e.status !== 413) throw e;
      flyerPage(ctx, ctx.row || null, ctx.row ? flyerValues(ctx.row) : flyerNew, { file: `That file is too large. Flyers must be ${flyerMaxMb} MB or smaller.` }, 413);
      return false;
    }
  };

  async function saveFlyer(ctx, row) {
    const { fields, files } = await ctx.body();
    const f = {};
    for (const fd of FLYER_FIELDS) f[fd.name] = schema.str(fields[fd.name]);
    const errors = schema.validateFields(FLYER_FIELDS, f, {});
    const upload = files.find((x) => x.field === 'file');
    const selfId = row ? row.id : 0;
    let check = null;
    if (!errors.kind) {
      if (f.kind === 'text') {
        if (!f.body && !errors.body) errors.body = 'Enter the flyer text.';
      } else {
        if (f.kind === 'image' && !f.alt && !errors.alt) errors.alt = 'Describe the image (alt text) so it is accessible.';
        if (upload) { check = uploads.validateFlyerFile(upload, f.kind); if (check.error) errors.file = check.error; }
        else if (!(row && row.kind === f.kind && row.file)) errors.file = f.kind === 'pdf' ? 'Choose a PDF to upload.' : 'Choose an image to upload.';
      }
    }
    // Duplicate protection: same title, or the exact same file, cannot be added twice.
    if (!errors.title && q.get('SELECT id FROM flyers WHERE lower(title) = lower(?) AND id != ?', f.title, selfId)) {
      errors.title = 'A flyer with this title already exists. Edit that one, or choose a different title.';
    }
    if (check && check.ok) {
      const dup = q.get('SELECT title FROM flyers WHERE sha256 = ? AND id != ?', check.sha256, selfId);
      if (dup) errors.file = `This exact file is already uploaded as “${dup.title}”. Edit that flyer instead of adding it twice.`;
    }
    if (hasErrors(errors)) return flyerPage(ctx, row, f, errors, 422);

    const data = {
      title: f.title, kind: f.kind, summary: f.summary, body: f.kind === 'text' ? f.body : '', alt: f.kind === 'image' ? f.alt : '',
      deadline: f.deadline, status: f.status || 'draft', sort: Number(f.sort || 0),
    };
    let replaced = false;
    if (check && check.ok) {
      const saved = uploads.saveFlyerFile(upload, check.kind);
      Object.assign(data, { file: saved.file, mime: saved.mime, size: saved.size, sha256: check.sha256, original_name: String(upload.filename || 'flyer').replace(/[^\w .()-]+/g, '_').slice(0, 200) });
      replaced = true;
    } else if (f.kind === 'text') {
      Object.assign(data, { file: '', mime: '', size: 0, sha256: '', original_name: '' });
      replaced = true;
    }
    if (data.status === 'published' && !(row && row.published_at)) data.published_at = now();
    data.updated_at = now();
    const cols = Object.keys(data);
    let id;
    if (row) {
      q.run(`UPDATE flyers SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, ...cols.map((c) => data[c]), row.id);
      id = row.id;
      if (replaced && row.file) uploads.deleteFlyerFile(row.file);
    } else {
      data.created_at = data.updated_at; cols.push('created_at');
      id = Number(q.run(`INSERT INTO flyers (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...cols.map((c) => data[c])).lastInsertRowid);
    }
    audit(ctx.session.user_id, `flyers.${row ? 'update' : 'create'}`, `#${id} “${data.title}” (${data.kind}, ${data.status})`);
    ctx.redirect(`/admin/flyers/${id}?${row ? 'saved' : 'created'}=1`);
  }

  get('/admin/flyers', jobs, (ctx) => ctx.html(flyerViews.listPage(ctx, { rows: q.all("SELECT * FROM flyers ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, sort, updated_at DESC") })));
  get('/admin/flyers/new', jobs, (ctx) => flyerPage(ctx, null, { ...flyerNew }, {}));
  post('/admin/flyers/new', jobs, flyerBody, csrf, (ctx) => saveFlyer(ctx, null));
  get('/admin/flyers/:id', jobs, loadRow('flyers'), (ctx) => flyerPage(ctx, ctx.row, flyerValues(ctx.row), {}));
  post('/admin/flyers/:id', jobs, loadRow('flyers'), flyerBody, csrf, (ctx) => saveFlyer(ctx, ctx.row));
  post('/admin/flyers/:id/status', jobs, csrf, loadRow('flyers'), async (ctx) => {
    const r = ctx.row; const to = schema.str((await fieldsOf(ctx)).status);
    if (!['draft', 'published'].includes(to)) return ctx.text('Unknown status', 400);
    q.run('UPDATE flyers SET status = ?, published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?', to, to === 'published' ? now() : null, now(), r.id);
    audit(ctx.session.user_id, 'flyers.status', `#${r.id} “${r.title}” ${r.status} → ${to}`);
    const back = ctx.req.headers.referer && /\/admin\/flyers\/\d+$/.test(new URL(ctx.req.headers.referer, 'http://x').pathname) ? `/admin/flyers/${r.id}` : '/admin/flyers';
    ctx.redirect(`${back}?status=1`);
  });
  post('/admin/flyers/:id/delete', jobs, csrf, loadRow('flyers'), (ctx) => {
    const r = ctx.row;
    q.run('DELETE FROM flyers WHERE id = ?', r.id);
    uploads.deleteFlyerFile(r.file);
    audit(ctx.session.user_id, 'flyers.delete', `#${r.id} “${r.title}” (${r.kind})`);
    ctx.redirect('/admin/flyers?deleted=1');
  });

  /* ── Enquiries ─────────────────────────────────────────────── */
  const enq = requireArea('enquiries');
  const enqFilters = { type: { column: 'type', test: (v) => inbox.ENQ_TYPES.includes(v) }, status: { column: 'status', test: (v) => inbox.ENQ_STATUSES.includes(v) } };
  function enquiriesList(ctx, src) {
    const r = listQuery({
      from: 'enquiries e LEFT JOIN programmes p ON p.id = e.programme_id', alias: 'e',
      select: 'e.id, e.ref, e.name, e.type, e.status, e.created_at, p.title AS programme_title', src, filters: enqFilters, searchCols: ['ref', 'name', 'email', 'message'],
    });
    ctx.html(inbox.enquiriesList(ctx, r));
  }
  get('/admin/enquiries', enq, (ctx) => enquiriesList(ctx, ctx.query));
  post('/admin/enquiries', enq, csrf, async (ctx) => {
    const f = await fieldsOf(ctx);
    if (!schema.str(f.q)) {
      const p = new URLSearchParams();
      for (const k of ['type', 'status', 'page']) { const v = schema.str(f[k]); if (v && /^[a-z0-9_]{1,20}$/.test(v)) p.set(k, v); }
      return ctx.redirect('/admin/enquiries' + (p.toString() ? `?${p}` : ''));
    }
    enquiriesList(ctx, f);
  });
  const loadEnquiry = (ctx) => {
    if (!loadRow('enquiries')(ctx)) return false;
    ctx.row.programme_title = ctx.row.programme_id ? (q.get('SELECT title FROM programmes WHERE id = ?', ctx.row.programme_id) || {}).title : '';
    return true;
  };
  get('/admin/enquiries/:id', enq, loadEnquiry, (ctx) => ctx.html(inbox.enquiryDetail(ctx, { e: ctx.row })));
  post('/admin/enquiries/:id', enq, csrf, loadEnquiry, async (ctx) => {
    const e = ctx.row; const status = schema.str((await fieldsOf(ctx)).status);
    if (!inbox.ENQ_STATUSES.includes(status)) return ctx.html(inbox.enquiryDetail(ctx, { e, errors: { status: 'Choose a valid status.' } }), 422);
    q.run('UPDATE enquiries SET status = ? WHERE id = ?', status, e.id);
    audit(ctx.session.user_id, 'enquiry.update', `${e.ref}: ${e.status} → ${status}`);
    ctx.redirect(`/admin/enquiries/${e.id}?saved=1`);
  });
  post('/admin/enquiries/:id/delete', enq, csrf, loadRow('enquiries'), (ctx) => {
    q.run('DELETE FROM enquiries WHERE id = ?', ctx.row.id);
    audit(ctx.session.user_id, 'enquiry.delete', ctx.row.ref);
    ctx.redirect('/admin/enquiries?deleted=1');
  });

  /* ── Media Library ─────────────────────────────────────────── */
  const content = requireArea('content');
  const maxMb = Math.round(config.imageMaxBytes / 1048576);
  const mediaItems = () => q.all('SELECT * FROM media ORDER BY created_at DESC, id DESC');
  const mediaPage = (ctx, extra = {}, status) => ctx.html(mediaViews.mediaPage(ctx, { items: mediaItems(), maxMb, ...extra }), status);

  get('/admin/media', content, (ctx) => mediaPage(ctx));
  post('/admin/media', content, async (ctx) => {
    // Parse the (large) multipart body here so an oversized file gets a friendly message.
    try { await ctx.body({ limit: config.imageMaxBytes + 64 * 1024 }); } catch (e) {
      if (e.status === 413) { mediaPage(ctx, { errors: { file: `That file is too large. Images must be ${maxMb} MB or smaller.` } }, 413); return false; }
      throw e;
    }
    return true;
  }, requireCsrf(), async (ctx) => {
    const { fields, files } = await ctx.body();
    const alt = schema.str(fields.alt);
    const file = files.find((x) => x.field === 'file');
    const errors = {};
    const check = uploads.validateImage(file);
    if (check.error) errors.file = check.error;
    if (!alt) errors.alt = 'Alt text is required. Describe what the photo shows.';
    else if (alt.length > 250) errors.alt = 'Alt text must be 250 characters or fewer.';
    if (hasErrors(errors)) return mediaPage(ctx, { errors, values: { alt } }, 422);
    const saved = uploads.saveImage(file, check.kind);
    const original = String(file.filename || 'image').replace(/[^\w .()-]+/g, '_').slice(0, 200);
    const r = q.run('INSERT INTO media (file, original_name, mime, size, alt, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', saved.file, original, saved.mime, saved.size, alt, ctx.session.user_id, now());
    audit(ctx.session.user_id, 'media.upload', `#${r.lastInsertRowid} ${saved.url}`);
    ctx.redirect('/admin/media?uploaded=1');
  });
  post('/admin/media/:id', content, csrf, loadRow('media'), async (ctx) => {
    const alt = schema.str((await fieldsOf(ctx)).alt);
    const problem = !alt ? 'Alt text is required.' : alt.length > 250 ? 'Alt text must be 250 characters or fewer.' : '';
    if (problem) return mediaPage(ctx, { itemErrors: { [ctx.row.id]: { message: problem, value: alt } } }, 422);
    q.run('UPDATE media SET alt = ? WHERE id = ?', alt, ctx.row.id);
    audit(ctx.session.user_id, 'media.alt', `#${ctx.row.id}`);
    ctx.redirect('/admin/media?saved=1');
  });
  post('/admin/media/:id/delete', content, csrf, loadRow('media'), (ctx) => {
    uploads.deleteImage(ctx.row.file);
    q.run('DELETE FROM media WHERE id = ?', ctx.row.id);
    audit(ctx.session.user_id, 'media.delete', `#${ctx.row.id} /uploads/${ctx.row.file}`);
    ctx.redirect('/admin/media?deleted=1');
  });

  /* ── Website Pages + Settings ──────────────────────────────── */
  get('/admin/pages', content, (ctx) => {
    ctx.html(dashViews.pagesHub(ctx, schema.SECTIONS.filter((s) => s.group === 'pages').map((s) => ({ key: s.key, label: s.label, description: schema.PAGE_DESCRIPTIONS[s.key] || '' }))));
  });
  get('/admin/settings', requireLogin, (ctx) => {
    const first = schema.SECTIONS.find((s) => s.group === 'settings' && can(ctx.session, s.area)) || schema.SECTIONS.find((s) => can(ctx.session, s.area));
    if (!first) return ctx.text('You do not have permission to view this page.', 403);
    ctx.redirect(`/admin/settings/${first.key}`);
  });

  const loadSection = (ctx) => {
    const sec = schema.SECTIONS.find((s) => s.key === ctx.params.section);
    if (!sec) return notFound(ctx, 'There is no settings section with that name.');
    if (!can(ctx.session, sec.area)) { ctx.text('You do not have permission to view this page.', 403); return false; }
    ctx.section = sec;
    return true;
  };
  const renderSection = (ctx, values, errors = {}, status) => {
    const sec = ctx.section;
    const resolved = { ...sec, description: typeof sec.description === 'function' ? sec.description() : sec.description };
    const sections = schema.SECTIONS.filter((s) => s.group === sec.group && can(ctx.session, s.area));
    ctx.html(settingsViews.settingsPage(ctx, { sections, section: resolved, values, errors, active: sec.group === 'pages' ? 'pages' : 'settings' }), status);
  };
  get('/admin/settings/:section', requireLogin, loadSection, (ctx) => renderSection(ctx, ctx.section.load(settings.all())));
  post('/admin/settings/:section', requireLogin, loadSection, csrf, async (ctx) => {
    const sec = ctx.section;
    const form = schema.readForm(sec.fields, await fieldsOf(ctx));
    const errors = schema.validateFields(sec.fields, form, {});
    const values = sec.parse(form, errors, settings.all());
    if (hasErrors(errors)) return renderSection(ctx, form, errors, 422);
    settings.set(values);
    audit(ctx.session.user_id, 'settings.update', `${sec.label}: ${Object.keys(values).join(', ')}`);
    ctx.redirect(`/admin/settings/${sec.key}?saved=1`);
  });

  /* ── Users & Permissions ───────────────────────────────────── */
  const usersArea = requireArea('users');
  const allUsers = () => q.all('SELECT id, name, email, role, totp_secret, last_login_at, created_at FROM users ORDER BY name COLLATE NOCASE');
  const adminCount = () => q.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").n;

  get('/admin/users', usersArea, (ctx) => ctx.html(userViews.usersList(ctx, { users: allUsers() })));
  post('/admin/users', usersArea, csrf, async (ctx) => {
    const f = await fieldsOf(ctx);
    const v = { name: schema.str(f.name), email: schema.str(f.email).toLowerCase(), role: schema.str(f.role) };
    const pw = typeof f.password === 'string' ? f.password : '';
    const errors = {};
    if (!v.name) errors.name = 'Enter their full name.'; else if (v.name.length > 100) errors.name = 'The name must be 100 characters or fewer.';
    if (!schema.EMAIL_RE.test(v.email) || v.email.length > 200) errors.email = 'Enter a valid email address.';
    else if (q.get('SELECT id FROM users WHERE email = ?', v.email)) errors.email = 'A user with this email address already exists.';
    if (!ROLES.includes(v.role)) errors.role = 'Choose a role.';
    const p = security.passwordProblem(pw);
    if (p) errors.password = `Initial password: ${p}`;
    if (hasErrors(errors)) return ctx.html(userViews.usersList(ctx, { users: allUsers(), values: v, errors }), 422);
    const r = q.run('INSERT INTO users (email, name, role, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)', v.email, v.name, v.role, security.hashPassword(pw), now());
    audit(ctx.session.user_id, 'user.create', `#${r.lastInsertRowid} ${v.name} <${v.email}> as ${v.role}`);
    ctx.redirect('/admin/users?created=1');
  });

  const userPage = (ctx, extra = {}, status) => ctx.html(userViews.userDetail(ctx, { u: ctx.row, ...extra }), status);
  get('/admin/users/:id', usersArea, loadRow('users'), (ctx) => userPage(ctx));
  post('/admin/users/:id/role', usersArea, csrf, loadRow('users'), async (ctx) => {
    const u = ctx.row; const role = schema.str((await fieldsOf(ctx)).role);
    if (!ROLES.includes(role)) return userPage(ctx, { errors: { role: 'Choose a valid role.' } }, 422);
    if (u.role === 'admin' && role !== 'admin' && adminCount() <= 1) return userPage(ctx, { errors: { role: 'This is the only administrator. Make someone else an administrator first.' }, values: { role } }, 422);
    q.run('UPDATE users SET role = ? WHERE id = ?', role, u.id);
    audit(ctx.session.user_id, 'user.role', `#${u.id} ${u.name}: ${u.role} → ${role}`);
    ctx.redirect(`/admin/users/${u.id}?saved=1`);
  });
  post('/admin/users/:id/password', usersArea, csrf, loadRow('users'), async (ctx) => {
    const u = ctx.row; const f = await fieldsOf(ctx);
    const pw = typeof f.password === 'string' ? f.password : '';
    const p = security.passwordProblem(pw);
    if (p) return userPage(ctx, { errors: { password: `New password: ${p}` } }, 422);
    q.run('UPDATE users SET pass_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?', security.hashPassword(pw), u.id);
    q.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', u.id, ctx.session.id);
    audit(ctx.session.user_id, 'user.password_reset', `#${u.id} ${u.name}`);
    ctx.redirect(`/admin/users/${u.id}?saved=1`);
  });
  post('/admin/users/:id/2fa/remove', usersArea, csrf, loadRow('users'), (ctx) => {
    const u = ctx.row;
    q.run('UPDATE users SET totp_secret = NULL WHERE id = ?', u.id);
    audit(ctx.session.user_id, 'user.2fa_removed', `#${u.id} ${u.name}`);
    ctx.redirect(`/admin/users/${u.id}?saved=1`);
  });
  post('/admin/users/:id/delete', usersArea, csrf, loadRow('users'), (ctx) => {
    const u = ctx.row;
    if (u.id === ctx.session.user_id) return userPage(ctx, { errors: { _form: 'You cannot delete your own account.' } }, 422);
    if (u.role === 'admin' && adminCount() <= 1) return userPage(ctx, { errors: { _form: 'You cannot delete the last administrator.' } }, 422);
    q.run('DELETE FROM users WHERE id = ?', u.id);
    audit(ctx.session.user_id, 'user.delete', `#${u.id} ${u.name} <${u.email}> (${u.role})`);
    ctx.redirect('/admin/users?deleted=1');
  });

  /* ── Audit log ─────────────────────────────────────────────── */
  get('/admin/audit', usersArea, (ctx) => {
    ctx.html(dashViews.auditPage(ctx, q.all('SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 200')));
  });
}

module.exports = { register };
