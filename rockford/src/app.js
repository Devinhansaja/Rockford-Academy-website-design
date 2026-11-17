'use strict';
/* Request pipeline: static files → security headers → router → handlers. */
const crypto = require('node:crypto');
const config = require('./config');
const settings = require('./settings');
const { Router } = require('./router');
const http = require('./http');
const security = require('./security');

const router = new Router();

/** Content-Security-Policy, built per request so analytics hosts are allowed only when configured. */
function csp(nonce, s) {
  const ga = !!(s.ga4_id || s.gtm_id);
  const gHosts = ga ? ' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com' : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${gHosts}`,
    "style-src 'self' https://fonts.googleapis.com",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: https://images.unsplash.com${gHosts}`,
    `connect-src 'self'${gHosts}`,
    'frame-src https://www.google.com https://www.youtube-nocookie.com',
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

function makeCtx(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const nonce = crypto.randomBytes(16).toString('base64');
  let sessionLoaded = false; let session = null; let body = null;
  const ctx = {
    req, res, url, nonce,
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    params: {},
    ip: security.clientIp(req),
    settings: settings.all(),
    get session() { if (!sessionLoaded) { session = security.getSession(req); sessionLoaded = true; } return session; },
    set session(v) { session = v; sessionLoaded = true; },
    /** Parse the body once. Options: { limit } in bytes. */
    async body(opts) { if (!body) body = await http.parseBody(req, opts); return body; },
    html: (markup, status = 200) => http.html(res, markup, status),
    redirect: (loc, status) => http.redirect(res, loc, status),
    text: (t, status, type) => http.text(res, t, status, type),
  };
  return ctx;
}

function securityHeaders(res, nonce, s) {
  res.setHeader('Content-Security-Policy', csp(nonce, s));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (config.cookieSecure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

let notFoundHandler = (ctx) => ctx.text('Not found', 404);
let errorHandler = (ctx) => ctx.text('Something went wrong', 500);

async function handle(req, res) {
  let ctx;
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if ((req.method === 'GET' || req.method === 'HEAD') && http.serveStatic(req, res, pathname)) return;
    ctx = makeCtx(req, res);
    securityHeaders(res, ctx.nonce, ctx.settings);
    if (!['GET', 'HEAD', 'POST'].includes(req.method)) return ctx.text('Method not allowed', 405);
    const match = router.match(req.method, ctx.path);
    if (!match) return await notFoundHandler(ctx);
    ctx.params = match.params;
    for (const fn of match.handlers) {
      const r = await fn(ctx);
      if (r === false || res.headersSent || res.writableEnded) break;
    }
    if (!res.headersSent) await notFoundHandler(ctx);
  } catch (e) {
    if (e instanceof http.HttpError) {
      if (!res.headersSent) {
        const msg = e.status === 413
          ? 'The file or form you sent is too large. Please go back and attach a smaller file (CVs up to ' + Math.round(config.cvMaxBytes / 1048576) + ' MB).'
          : e.message;
        http.html(res, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e.status}</title><body style="font:16px/1.6 system-ui,sans-serif;max-width:640px;margin:15vh auto;padding:0 20px;color:#14243B"><h1 style="font-weight:500">${security.h(msg)}</h1><p>Use your browser's back button to return to the form, or go to <a href="/careers" style="color:#234B73">Careers</a> · <a href="/" style="color:#234B73">Homepage</a>.</p></body>`, e.status);
      }
      return;
    }
    console.error('[error]', req.method, req.url, e);
    if (!res.headersSent) {
      try { await errorHandler(ctx || makeCtx(req, res)); } catch { http.text(res, 'Something went wrong', 500); }
    }
  }
}

module.exports = {
  router,
  handle,
  setNotFound: (fn) => { notFoundHandler = fn; },
  setErrorHandler: (fn) => { errorHandler = fn; },
};
