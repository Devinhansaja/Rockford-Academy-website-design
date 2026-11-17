'use strict';
/* Website Settings: one tab per section, each its own form. */
const { h } = require('../../security');
const { layout } = require('./layout');
const ui = require('./ui');

/** sections: visible [{ key, label }]; section: current { key, label, description, fields } */
function settingsPage(ctx, { sections, section, values, errors = {}, active }) {
  const tabs = sections.map((s) => `<li><a href="/admin/settings/${h(s.key)}"${s.key === section.key ? ' aria-current="page" class="active"' : ''}>${h(s.label)}</a></li>`).join('');
  return layout(ctx, {
    title: `${section.label} · Settings`,
    active,
    body: `${ui.pageHeader(active === 'pages' ? 'Website Pages' : 'Website Settings')}
<nav class="tabs" aria-label="Settings sections"><ul>${tabs}</ul></nav>
${ui.notices(ctx.query)}
${ui.errorSummary(errors)}
<form method="post" action="/admin/settings/${h(section.key)}" class="stack settings-form">
  ${ui.csrfField(ctx.session)}
  <h2>${h(section.label)}</h2>
  ${section.description ? `<p class="hint">${h(section.description)}</p>` : ''}
  ${ui.fields(section.fields, values, errors)}
  <div class="actions sticky-actions"><button type="submit" class="btn btn-primary">Save ${h(section.label.toLowerCase())}</button></div>
</form>`,
  });
}

module.exports = { settingsPage };
