'use strict';
/*
 * Small building blocks for admin pages: dates, notices, form fields, tables, pagination.
 * Every value that came from a user or the database goes through h().
 */
const { h } = require('../../security');

const TZ = 'Asia/Colombo';

const fmtDateTime = (ms) => (ms ? new Date(Number(ms)).toLocaleString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDate = (ms) => (ms ? new Date(Number(ms)).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }) : '—');
/** YYYY-MM-DD in Colombo time (for <input type="date">). */
const isoDate = (ms) => (ms ? new Date(Number(ms)).toLocaleDateString('en-CA', { timeZone: TZ }) : '');
/** Start of a YYYY-MM-DD day in Colombo time, as epoch ms. */
const fromIsoDate = (s) => Date.parse(`${s}T00:00:00+05:30`);

const csrfField = (session) => `<input type="hidden" name="_csrf" value="${h(session && session.csrf)}">`;

/* ── Notices ─────────────────────────────────────────────────── */
const NOTICES = {
  saved: 'Your changes have been saved.',
  created: 'Created successfully.',
  deleted: 'Deleted.',
  uploaded: 'Image uploaded.',
  password: 'Your password has been changed.',
  twofa_on: 'Two-factor authentication is now on. You will be asked for a code each time you sign in.',
  twofa_off: 'Two-factor authentication has been turned off.',
  status: 'Status updated.',
};
function notices(query) {
  return Object.keys(NOTICES).filter((k) => query[k] === '1')
    .map((k) => `<div class="alert alert-success" role="status">${h(NOTICES[k])}</div>`).join('');
}
const alertBox = (msg, kind = 'error') => (msg ? `<div class="alert alert-${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${h(msg)}</div>` : '');

function errorSummary(errors) {
  const keys = Object.keys(errors || {});
  if (!keys.length) return '';
  const items = keys.map((k) => (k === '_form' ? `<li>${h(errors[k])}</li>` : `<li><a href="#f-${h(k)}">${h(errors[k])}</a></li>`)).join('');
  return `<div class="alert alert-error" role="alert" tabindex="-1" data-autofocus><p><strong>Please correct ${keys.length === 1 ? 'the problem' : `these ${keys.length} problems`}:</strong></p><ul>${items}</ul></div>`;
}

/* ── Form fields ─────────────────────────────────────────────── */
const MD_HINT = 'Markdown: ## Heading, **bold**, _italic_, - bullet list, 1. numbered list, > quote, [link text](https://example.com). Leave a blank line between paragraphs.';

/**
 * Render one field. f = { name, label, type, hint, options:[[value,label]], required, maxlength, rows, placeholder, attrs }
 * Types: text, email, url, password, number, date, textarea, markdown, lines, select, checkbox, readonly.
 */
function field(f, value, error) {
  const id = `f-${f.name}`;
  const v = value === undefined || value === null ? '' : value;
  const describedBy = [];
  let hint = f.hint || '';
  if (f.type === 'markdown') hint = hint ? `${hint} ${MD_HINT}` : MD_HINT;
  if (f.type === 'lines') hint = hint || 'One item per line.';
  if (hint) describedBy.push(`${id}-hint`);
  if (error) describedBy.push(`${id}-err`);
  const common = `id="${id}" name="${h(f.name)}"${f.required ? ' required' : ''}${f.maxlength ? ` maxlength="${f.maxlength}"` : ''}${describedBy.length ? ` aria-describedby="${describedBy.join(' ')}"` : ''}${error ? ' aria-invalid="true"' : ''}${f.placeholder ? ` placeholder="${h(f.placeholder)}"` : ''}${f.attrs ? ' ' + f.attrs : ''}`;
  const hintHtml = hint ? `<p class="hint" id="${id}-hint">${h(hint)}</p>` : '';
  const errHtml = error ? `<p class="field-error" id="${id}-err">${h(error)}</p>` : '';
  const req = f.required ? ' <span class="req" aria-hidden="true">*</span>' : '';

  if (f.type === 'checkbox') {
    return `<div class="field field-check${error ? ' has-error' : ''}"><input type="checkbox" value="1" ${common}${v && v !== '0' ? ' checked' : ''}><label for="${id}">${h(f.label)}</label>${hintHtml}${errHtml}</div>`;
  }
  let control;
  switch (f.type) {
    case 'textarea': case 'markdown': case 'lines':
      control = `<textarea ${common} rows="${f.rows || (f.type === 'markdown' ? 14 : 4)}"${f.type === 'markdown' ? ' class="mono"' : ''}>${h(v)}</textarea>`;
      break;
    case 'select':
      control = `<select ${common}>${(f.options || []).map(([ov, ol]) => `<option value="${h(ov)}"${String(ov) === String(v) ? ' selected' : ''}>${h(ol)}</option>`).join('')}</select>`;
      break;
    case 'readonly':
      control = `<input type="text" readonly ${common} value="${h(v)}">`;
      break;
    default:
      control = `<input type="${f.type || 'text'}" ${common} value="${h(f.type === 'password' ? '' : v)}"${f.type === 'password' ? ' autocomplete="' + (f.autocomplete || 'new-password') + '"' : ''}>`;
  }
  return `<div class="field${error ? ' has-error' : ''}${f.wide ? ' field-wide' : ''}"><label for="${id}">${h(f.label)}${req}</label>${hintHtml}${control}${errHtml}</div>`;
}

/** Render a list of fields; entries like { section: 'SEO', note } start a new fieldset. */
function fields(list, values = {}, errors = {}) {
  let out = ''; let open = false;
  for (const f of list) {
    if (f.section) {
      if (open) out += '</fieldset>';
      out += `<fieldset class="panel"><legend>${h(f.section)}</legend>${f.note ? `<p class="hint">${h(f.note)}</p>` : ''}`;
      open = true;
      continue;
    }
    out += field(f, values[f.name], errors[f.name]);
  }
  if (open) out += '</fieldset>';
  return out;
}

/* ── Misc ────────────────────────────────────────────────────── */
const badge = (text, kind = '') => `<span class="badge${kind ? ' badge-' + h(kind) : ''}">${h(text)}</span>`;
const STATUS_KIND = {
  published: 'ok', open: 'ok', enrolling: 'ok', hired: 'ok', closed: 'muted', archived: 'muted', draft: 'warn',
  received: 'new', new: 'new', reviewing: 'info', in_progress: 'info', shortlisted: 'info', waitlist: 'info',
  coming_soon: 'warn', unsuccessful: 'muted', withdrawn: 'muted',
};
const humanize = (s) => String(s || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const statusBadge = (s) => badge(humanize(s), STATUS_KIND[s] || '');

/** Preserve line breaks in plain text. */
const multiline = (s) => h(s).replace(/\r?\n/g, '<br>');

function table(columns, rows, empty = 'Nothing here yet.') {
  if (!rows.length) return `<p class="empty">${h(empty)}</p>`;
  return `<div class="table-wrap"><table><thead><tr>${columns.map((c) => `<th scope="col">${h(c.label)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r) => `<tr>${columns.map((c, i) => (i === 0 ? `<th scope="row">${c.render(r)}</th>` : `<td data-label="${h(c.label)}">${c.render(r)}</td>`)).join('')}</tr>`).join('')
  }</tbody></table></div>`;
}

/**
 * Pagination. If `post` is set (search contains free text), pages are buttons in a POST form so
 * search terms never appear in the URL; otherwise plain links.
 */
function pager({ page, pages, baseUrl, params = {}, post = null, session }) {
  if (pages <= 1) return '';
  const nums = [];
  for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - page) <= 2) nums.push(p);
  const items = []; let last = 0;
  for (const p of nums) {
    if (p - last > 1) items.push('<span class="pager-gap">…</span>');
    last = p;
    if (p === page) { items.push(`<span class="pager-current" aria-current="page">${p}</span>`); continue; }
    if (post) items.push(`<button type="submit" name="page" value="${p}" class="pager-link">${p}</button>`);
    else {
      const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null)), page: String(p) });
      items.push(`<a class="pager-link" href="${h(baseUrl)}?${h(qs.toString())}">${p}</a>`);
    }
  }
  const inner = `<nav class="pager" aria-label="Pages">${items.join('')}</nav>`;
  if (!post) return inner;
  const hidden = Object.entries(post).map(([k, v]) => `<input type="hidden" name="${h(k)}" value="${h(v)}">`).join('');
  return `<form method="post" action="${h(baseUrl)}">${csrfField(session)}${hidden}${inner}</form>`;
}

/** A small POST form with one button (delete, publish…). */
function actionForm(action, label, session, { confirm, cls = 'btn', hidden = {} } = {}) {
  const hid = Object.entries(hidden).map(([k, v]) => `<input type="hidden" name="${h(k)}" value="${h(v)}">`).join('');
  return `<form method="post" action="${h(action)}" class="inline-form"${confirm ? ` data-confirm="${h(confirm)}"` : ''}>${csrfField(session)}${hid}<button type="submit" class="${h(cls)}">${h(label)}</button></form>`;
}

const pageHeader = (title, actions = '', sub = '') => `<div class="page-head"><div><h1>${h(title)}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;

module.exports = {
  TZ, fmtDateTime, fmtDate, isoDate, fromIsoDate, csrfField, notices, alertBox, errorSummary,
  field, fields, badge, statusBadge, humanize, multiline, table, pager, actionForm, pageHeader, MD_HINT,
};
