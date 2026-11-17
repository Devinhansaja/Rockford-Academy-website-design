'use strict';
/* Dashboard, "Website Pages" hub and audit log. */
const { h } = require('../../security');
const { layout } = require('./layout');
const ui = require('./ui');

/** counts: [{ label, value, href }]; checklist: [{ title, text, href, link }] */
function dashboard(ctx, { counts, checklist, showChecklist }) {
  const tiles = counts.map((c) => `<li><a class="stat" href="${h(c.href)}"><span class="stat-value">${Number(c.value)}</span><span class="stat-label">${h(c.label)}</span></a></li>`).join('');
  let check = '';
  if (showChecklist) {
    check = `<section class="panel" aria-labelledby="chk-h">
  <h2 id="chk-h">Setup checklist</h2>
  ${checklist.length ? `<p class="hint">These items need attention before or soon after launch.</p><ul class="checklist">${checklist.map((c) => `<li class="check-warn"><div><strong>${h(c.title)}</strong><p>${h(c.text)}</p></div>${c.href ? `<a class="btn btn-small" href="${h(c.href)}">${h(c.link || 'Fix')}</a>` : ''}</li>`).join('')}</ul>` : '<p class="check-ok">Everything on the checklist is done. Nice work.</p>'}
</section>`;
  }
  return layout(ctx, {
    title: 'Dashboard',
    active: 'dashboard',
    body: `${ui.pageHeader(`Welcome, ${ctx.session.name}`, '', 'Here is what needs your attention.')}
${ui.notices(ctx.query)}
${tiles ? `<ul class="stats">${tiles}</ul>` : ''}
${check}`,
  });
}

function pagesHub(ctx, sections) {
  const cards = sections.map((s) => `<li class="panel card"><h2><a href="/admin/settings/${h(s.key)}">${h(s.label)}</a></h2><p>${h(s.description)}</p></li>`).join('');
  return layout(ctx, {
    title: 'Website Pages',
    active: 'pages',
    body: `${ui.pageHeader('Website Pages', '', 'Edit the words and images on fixed pages of the website. Programmes, vacancies and news have their own sections.')}
<ul class="cards">${cards}</ul>`,
  });
}

function auditPage(ctx, rows) {
  const cols = [
    { label: 'When', render: (r) => h(ui.fmtDateTime(r.created_at)) },
    { label: 'Who', render: (r) => (r.user_name ? h(r.user_name) : '<span class="muted">System</span>') },
    { label: 'Action', render: (r) => `<code>${h(r.action)}</code>` },
    { label: 'Detail', render: (r) => h(r.detail) },
  ];
  return layout(ctx, {
    title: 'Audit log',
    active: 'audit',
    body: `${ui.pageHeader('Audit log', '', 'The latest 200 recorded actions.')}
${ui.table(cols, rows, 'Nothing recorded yet.')}`,
  });
}

module.exports = { dashboard, pagesHub, auditPage };
