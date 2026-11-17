'use strict';
/* Users & Permissions. */
const { h } = require('../../security');
const { layout, ROLE_LABEL } = require('./layout');
const ui = require('./ui');

const ROLE_HELP = {
  admin: 'Everything, including website settings, users and the audit log.',
  editor: 'Programmes, news, testimonials, media, website pages and enquiries.',
  recruiter: 'Vacancies and job applications, including CV downloads.',
};
const roleOptions = Object.keys(ROLE_HELP).map((r) => [r, `${ROLE_LABEL[r]} – ${ROLE_HELP[r]}`]);

function usersList(ctx, { users, values = {}, errors = {} }) {
  const s = ctx.session;
  const cols = [
    { label: 'Name', render: (u) => `<a href="/admin/users/${u.id}">${h(u.name)}</a>${u.id === s.user_id ? ' <span class="muted">(you)</span>' : ''}` },
    { label: 'Email', render: (u) => h(u.email) },
    { label: 'Role', render: (u) => h(ROLE_LABEL[u.role] || u.role) },
    { label: '2FA', render: (u) => (u.totp_secret ? ui.badge('On', 'ok') : ui.badge('Off', 'warn')) },
    { label: 'Last sign-in', render: (u) => h(u.last_login_at ? ui.fmtDateTime(u.last_login_at) : 'Never') },
  ];
  const fields = [
    { name: 'name', label: 'Full name', required: true, maxlength: 100 },
    { name: 'email', label: 'Email address', type: 'email', required: true, maxlength: 200 },
    { name: 'role', label: 'Role', type: 'select', options: roleOptions },
    { name: 'password', label: 'Initial password', type: 'password', required: true, hint: 'At least 12 characters with letters and numbers. Share it securely; ask them to change it after signing in.' },
  ];
  return layout(ctx, {
    title: 'Users & Permissions',
    active: 'users',
    body: `${ui.pageHeader('Users & Permissions')}
${ui.notices(ctx.query)}
${ui.table(cols, users)}
<section class="panel" aria-labelledby="new-h">
  <h2 id="new-h">Add a user</h2>
  <ul class="role-help">${Object.entries(ROLE_HELP).map(([r, t]) => `<li><strong>${h(ROLE_LABEL[r])}:</strong> ${h(t)}</li>`).join('')}</ul>
  ${ui.errorSummary(errors)}
  <form method="post" action="/admin/users" class="stack narrow">
    ${ui.csrfField(s)}
    ${ui.fields(fields, { role: 'editor', ...values }, errors)}
    <button type="submit" class="btn btn-primary">Create user</button>
  </form>
</section>`,
  });
}

function userDetail(ctx, { u, errors = {}, values = {} }) {
  const s = ctx.session;
  const self = u.id === s.user_id;
  return layout(ctx, {
    title: u.name,
    active: 'users',
    body: `<p class="crumbs"><a href="/admin/users">← Users</a></p>
${ui.pageHeader(u.name, '', `${h(u.email)} · ${h(ROLE_LABEL[u.role] || u.role)}${self ? ' · this is you' : ''}`)}
${ui.notices(ctx.query)}
${ui.errorSummary(errors)}
<div class="two-col">
  <form method="post" action="/admin/users/${u.id}/role" class="panel stack">
    ${ui.csrfField(s)}
    <h2>Role</h2>
    ${ui.field({ name: 'role', label: 'Role', type: 'select', options: roleOptions }, values.role || u.role, errors.role)}
    <button type="submit" class="btn btn-primary">Change role</button>
  </form>
  <form method="post" action="/admin/users/${u.id}/password" class="panel stack">
    ${ui.csrfField(s)}
    <h2>Reset password</h2>
    ${ui.field({ name: 'password', label: 'New password', type: 'password', required: true, hint: 'They will be signed out everywhere.' }, '', errors.password)}
    <button type="submit" class="btn btn-primary">Set new password</button>
  </form>
  <div class="panel">
    <h2>Two-factor authentication</h2>
    ${u.totp_secret ? `<p>${ui.badge('On', 'ok')} Remove it if they have lost their phone. They can set it up again from My account.</p>
    ${ui.actionForm(`/admin/users/${u.id}/2fa/remove`, 'Remove two-factor authentication', s, { confirm: 'Remove two-factor authentication for this user?', cls: 'btn' })}` : `<p>${ui.badge('Off', 'warn')} Ask them to turn it on from My account.</p>`}
  </div>
  <div class="panel">
    <h2>Delete user</h2>
    ${self ? '<p class="hint">You cannot delete your own account.</p>' : `<p class="hint">Their sign-in stops working immediately. Audit entries are kept.</p>
    ${ui.actionForm(`/admin/users/${u.id}/delete`, 'Delete user', s, { confirm: `Delete ${u.name}'s account? This cannot be undone.`, cls: 'btn btn-danger' })}`}
  </div>
</div>
<p class="meta">Created ${h(ui.fmtDateTime(u.created_at))} · Last sign-in ${h(u.last_login_at ? ui.fmtDateTime(u.last_login_at) : 'never')}</p>`,
  });
}

module.exports = { usersList, userDetail, ROLE_HELP };
