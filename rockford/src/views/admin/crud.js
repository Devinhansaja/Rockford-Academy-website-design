'use strict';
/* Generic list + edit form pages for programmes, vacancies, articles and testimonials. */
const { h } = require('../../security');
const { layout } = require('./layout');
const ui = require('./ui');

function listPage(ctx, def, rows) {
  const s = ctx.session;
  const actions = `<a class="btn btn-primary" href="/admin/${def.key}/new">Add ${h(def.singular.toLowerCase())}</a>`;
  return layout(ctx, {
    title: def.label,
    active: def.key,
    body: `${ui.pageHeader(def.label, actions, def.intro || '')}
${ui.notices(ctx.query)}
${ui.table(def.listColumns.concat(def.listActions ? [{ label: 'Actions', render: (r) => def.listActions(r, s) }] : []), rows, def.empty || `No ${def.label.toLowerCase()} yet.`)}`,
  });
}

/** opts: { id, row, values, errors } – row is the stored record (absent for new). */
function formPage(ctx, def, { id, row, values, errors = {} }) {
  const s = ctx.session;
  const isNew = !id;
  const title = isNew ? `Add ${def.singular.toLowerCase()}` : `Edit ${def.singular.toLowerCase()}`;
  const action = isNew ? `/admin/${def.key}/new` : `/admin/${def.key}/${id}`;
  const aside = isNew ? '' : `<aside class="side-panel" aria-label="Actions">
  ${def.aside ? def.aside(row, s) : ''}
  <div class="panel">
    <h2>Delete</h2>
    <p class="hint">This cannot be undone.</p>
    ${ui.actionForm(`/admin/${def.key}/${id}/delete`, `Delete ${def.singular.toLowerCase()}`, s, { confirm: `Delete “${row.title || row.name}” permanently? This cannot be undone.`, cls: 'btn btn-danger' })}
  </div>
  <p class="meta">Created ${h(ui.fmtDateTime(row.created_at))}<br>Last updated ${h(ui.fmtDateTime(row.updated_at))}</p>
</aside>`;
  return layout(ctx, {
    title,
    active: def.key,
    body: `<p class="crumbs"><a href="/admin/${def.key}">← ${h(def.label)}</a></p>
${ui.pageHeader(isNew ? title : (row.title || row.name || title), '', isNew ? '' : ui.statusBadge(row.status))}
${ui.notices(ctx.query)}
${ui.errorSummary(errors)}
<div class="edit-grid${isNew ? ' no-aside' : ''}">
  <form method="post" action="${h(action)}" class="stack edit-main">
    ${ui.csrfField(s)}
    ${ui.fields(def.fields, values, errors)}
    <div class="actions sticky-actions"><button type="submit" class="btn btn-primary">${isNew ? 'Create' : 'Save changes'}</button> <a class="btn" href="/admin/${def.key}">Cancel</a></div>
  </form>
  ${aside}
</div>`,
  });
}

module.exports = { listPage, formPage };
