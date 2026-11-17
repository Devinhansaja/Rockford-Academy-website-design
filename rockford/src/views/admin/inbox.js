'use strict';
/* Applications and enquiries: filterable lists and detail pages. */
const { h } = require('../../security');
const { layout } = require('./layout');
const ui = require('./ui');

const APP_STATUSES = ['received', 'reviewing', 'shortlisted', 'unsuccessful', 'hired', 'withdrawn'];
const ENQ_STATUSES = ['new', 'in_progress', 'closed'];
const ENQ_TYPES = ['general', 'programme', 'careers'];

const opt = (v, label, cur) => `<option value="${h(v)}"${String(v) === String(cur) ? ' selected' : ''}>${h(label)}</option>`;
const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function filterForm(ctx, base, f, selects, searchLabel) {
  return `<form method="post" action="${base}" class="filters" role="search">
  ${ui.csrfField(ctx.session)}
  <div class="field"><label for="f-q">${h(searchLabel)}</label><input type="search" id="f-q" name="q" value="${h(f.q)}" maxlength="100"></div>
  ${selects}
  <div class="filter-actions"><button type="submit" class="btn btn-primary">Apply</button> <a class="btn" href="${base}">Clear</a></div>
</form>`;
}

function summaryLine(total, f) {
  return `<p class="result-count" role="status">${total} result${total === 1 ? '' : 's'}${f.q ? ` for “${h(f.q)}”` : ''}</p>`;
}

/* ── Applications ────────────────────────────────────────────── */
function applicationsList(ctx, { rows, total, page, pages, f, vacancies }) {
  const selects = `<div class="field"><label for="f-vacancy">Vacancy</label><select id="f-vacancy" name="vacancy">${opt('', 'All vacancies', f.vacancy)}${vacancies.map((v) => opt(v.id, `${v.title} (${ui.humanize(v.status)})`, f.vacancy)).join('')}</select></div>
  <div class="field"><label for="f-status">Status</label><select id="f-status" name="status">${opt('', 'Any status', f.status)}${APP_STATUSES.map((s) => opt(s, ui.humanize(s), f.status)).join('')}</select></div>`;
  const cols = [
    { label: 'Reference', render: (r) => `<a href="/admin/applications/${r.id}">${h(r.ref)}</a>` },
    { label: 'Name', render: (r) => h(r.name) },
    { label: 'Position', render: (r) => h(r.position) },
    { label: 'Received', render: (r) => h(ui.fmtDateTime(r.created_at)) },
    { label: 'Status', render: (r) => ui.statusBadge(r.status) },
  ];
  return layout(ctx, {
    title: 'Applications',
    active: 'applications',
    body: `${ui.pageHeader('Job applications', '', 'Newest first. Applications and CVs are deleted automatically when their retention period ends.')}
${ui.notices(ctx.query)}
${filterForm(ctx, '/admin/applications', f, selects, 'Search reference, name, email or position')}
${summaryLine(total, f)}
${ui.table(cols, rows, 'No applications match.')}
${ui.pager({ page, pages, baseUrl: '/admin/applications', params: { vacancy: f.vacancy, status: f.status }, post: f.q ? { q: f.q, vacancy: f.vacancy, status: f.status } : null, session: ctx.session })}`,
  });
}

function dl(items) {
  return `<dl class="details">${items.filter(Boolean).map(([k, v]) => `<div><dt>${h(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

function applicationDetail(ctx, { a, vacancy, errors = {}, values }) {
  const s = ctx.session;
  const v = values || { status: a.status, notes: a.notes };
  return layout(ctx, {
    title: `Application ${a.ref}`,
    active: 'applications',
    body: `<p class="crumbs"><a href="/admin/applications">← Applications</a></p>
${ui.pageHeader(a.name, '', `${h(a.ref)} · ${ui.statusBadge(a.status)}`)}
${ui.notices(ctx.query)}
${ui.errorSummary(errors)}
<div class="edit-grid">
  <div class="edit-main">
    <section class="panel">
      <h2>Applicant</h2>
      ${dl([
        ['Position', vacancy ? `<a href="/admin/vacancies/${vacancy.id}">${h(a.position)}</a>` : h(a.position)],
        ['Name', h(a.name)],
        ['Email', `<a href="mailto:${h(a.email)}">${h(a.email)}</a>`],
        ['Phone', `<a href="tel:${h(String(a.phone).replace(/[^0-9+]/g, ''))}">${h(a.phone)}</a>`],
        ['Received', h(ui.fmtDateTime(a.created_at))],
        ['Qualifications', `<div class="prose-text">${ui.multiline(a.qualifications)}</div>`],
        ['Experience', `<div class="prose-text">${ui.multiline(a.experience)}</div>`],
        ['Message', a.message ? `<div class="prose-text">${ui.multiline(a.message)}</div>` : '<span class="muted">None</span>'],
      ])}
    </section>
    <section class="panel">
      <h2>CV</h2>
      <p>${h(a.cv_name)} <span class="muted">(${h(fmtSize(a.cv_size))})</span></p>
      <p><a class="btn btn-primary" href="/admin/applications/${a.id}/cv" download>Download CV</a></p>
      <p class="hint">CVs are private and are only available here. Downloads are recorded in the audit log.</p>
    </section>
  </div>
  <aside class="side-panel">
    <form method="post" action="/admin/applications/${a.id}" class="panel stack">
      ${ui.csrfField(s)}
      <h2>Review</h2>
      ${ui.field({ name: 'status', label: 'Status', type: 'select', options: APP_STATUSES.map((x) => [x, ui.humanize(x)]) }, v.status, errors.status)}
      ${ui.field({ name: 'notes', label: 'Internal notes', type: 'textarea', rows: 6, maxlength: 5000, hint: 'Only visible to staff.' }, v.notes, errors.notes)}
      <button type="submit" class="btn btn-primary">Save</button>
    </form>
    <div class="panel">
      <h2>Data retention</h2>
      <p>This application and CV will be deleted automatically on <strong>${h(ui.fmtDate(a.retention_until))}</strong>.</p>
      ${ui.actionForm(`/admin/applications/${a.id}/delete`, 'Delete now', s, { confirm: 'Delete this application and its CV permanently? This cannot be undone.', cls: 'btn btn-danger' })}
    </div>
  </aside>
</div>`,
  });
}

/* ── Enquiries ───────────────────────────────────────────────── */
function enquiriesList(ctx, { rows, total, page, pages, f }) {
  const selects = `<div class="field"><label for="f-type">Type</label><select id="f-type" name="type">${opt('', 'All types', f.type)}${ENQ_TYPES.map((t) => opt(t, ui.humanize(t), f.type)).join('')}</select></div>
  <div class="field"><label for="f-status">Status</label><select id="f-status" name="status">${opt('', 'Any status', f.status)}${ENQ_STATUSES.map((s) => opt(s, ui.humanize(s), f.status)).join('')}</select></div>`;
  const cols = [
    { label: 'Reference', render: (r) => `<a href="/admin/enquiries/${r.id}">${h(r.ref)}</a>` },
    { label: 'Name', render: (r) => h(r.name) },
    { label: 'Type', render: (r) => h(ui.humanize(r.type)) + (r.programme_title ? `<br><span class="muted">${h(r.programme_title)}</span>` : '') },
    { label: 'Received', render: (r) => h(ui.fmtDateTime(r.created_at)) },
    { label: 'Status', render: (r) => ui.statusBadge(r.status) },
  ];
  return layout(ctx, {
    title: 'Enquiries',
    active: 'enquiries',
    body: `${ui.pageHeader('Enquiries', '', 'Messages sent through the website. Newest first.')}
${ui.notices(ctx.query)}
${filterForm(ctx, '/admin/enquiries', f, selects, 'Search reference, name, email or message')}
${summaryLine(total, f)}
${ui.table(cols, rows, 'No enquiries match.')}
${ui.pager({ page, pages, baseUrl: '/admin/enquiries', params: { type: f.type, status: f.status }, post: f.q ? { q: f.q, type: f.type, status: f.status } : null, session: ctx.session })}`,
  });
}

function enquiryDetail(ctx, { e, errors = {} }) {
  const s = ctx.session;
  return layout(ctx, {
    title: `Enquiry ${e.ref}`,
    active: 'enquiries',
    body: `<p class="crumbs"><a href="/admin/enquiries">← Enquiries</a></p>
${ui.pageHeader(e.name, '', `${h(e.ref)} · ${ui.statusBadge(e.status)}`)}
${ui.notices(ctx.query)}
${ui.errorSummary(errors)}
<div class="edit-grid">
  <section class="panel edit-main">
    <h2>Message</h2>
    ${dl([
      ['Type', h(ui.humanize(e.type))],
      e.programme_title ? ['Programme', `<a href="/admin/programmes/${e.programme_id}">${h(e.programme_title)}</a>`] : null,
      e.topic ? ['Topic', h(e.topic)] : null,
      ['Name', h(e.name)],
      ['Email', `<a href="mailto:${h(e.email)}">${h(e.email)}</a>`],
      e.phone ? ['Phone', `<a href="tel:${h(String(e.phone).replace(/[^0-9+]/g, ''))}">${h(e.phone)}</a>`] : null,
      ['Received', h(ui.fmtDateTime(e.created_at))],
      ['Message', `<div class="prose-text">${ui.multiline(e.message)}</div>`],
    ])}
  </section>
  <aside class="side-panel">
    <form method="post" action="/admin/enquiries/${e.id}" class="panel stack">
      ${ui.csrfField(s)}
      <h2>Status</h2>
      ${ui.field({ name: 'status', label: 'Status', type: 'select', options: ENQ_STATUSES.map((x) => [x, ui.humanize(x)]) }, e.status, errors.status)}
      <button type="submit" class="btn btn-primary">Update status</button>
    </form>
    <div class="panel">
      <h2>Data retention</h2>
      <p>This enquiry will be deleted automatically on <strong>${h(ui.fmtDate(e.retention_until))}</strong>.</p>
      ${ui.actionForm(`/admin/enquiries/${e.id}/delete`, 'Delete now', s, { confirm: 'Delete this enquiry permanently? This cannot be undone.', cls: 'btn btn-danger' })}
    </div>
  </aside>
</div>`,
  });
}

module.exports = { applicationsList, applicationDetail, enquiriesList, enquiryDetail, APP_STATUSES, ENQ_STATUSES, ENQ_TYPES };
