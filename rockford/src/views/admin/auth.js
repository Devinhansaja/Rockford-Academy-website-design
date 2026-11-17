'use strict';
/* Sign-in, two-factor and "My account" pages. */
const { h } = require('../../security');
const { layout, bare } = require('./layout');
const ui = require('./ui');

function loginPage(ctx, { email = '', error = '', token, next = '' }) {
  return bare(ctx, {
    title: 'Sign in',
    body: `<h1>Sign in</h1>
${ui.alertBox(error)}
${ctx.query.loggedout === '1' ? ui.alertBox('You have been signed out.', 'success') : ''}
<form method="post" action="/admin/login" class="stack">
  <input type="hidden" name="_token" value="${h(token)}">
  <input type="hidden" name="next" value="${h(next)}">
  <div class="field"><label for="f-email">Email address</label><input type="email" id="f-email" name="email" value="${h(email)}" autocomplete="username" required autofocus></div>
  <div class="field"><label for="f-password">Password</label><input type="password" id="f-password" name="password" autocomplete="current-password" required></div>
  <button type="submit" class="btn btn-primary btn-block">Sign in</button>
</form>
<p class="hint">Forgotten your password? Ask a Rockford administrator to reset it.</p>`,
  });
}

function twofaPage(ctx, { error = '', next = '' }) {
  return bare(ctx, {
    title: 'Two-factor authentication',
    body: `<h1>Enter your 6-digit code</h1>
<p>Open your authenticator app and enter the current code for Rockford Academy.</p>
${ui.alertBox(error)}
<form method="post" action="/admin/2fa" class="stack">
  ${ui.csrfField(ctx.session)}
  <input type="hidden" name="next" value="${h(next)}">
  <div class="field"><label for="f-code">Authentication code</label><input type="text" id="f-code" name="code" inputmode="numeric" pattern="[0-9 ]{6,7}" maxlength="7" autocomplete="one-time-code" required autofocus></div>
  <button type="submit" class="btn btn-primary btn-block">Verify</button>
</form>
<form method="post" action="/admin/logout" class="stack">${ui.csrfField(ctx.session)}<button type="submit" class="btn btn-link">Cancel and sign out</button></form>`,
  });
}

const groupSecret = (s) => String(s).replace(/(.{4})/g, '$1 ').trim();

function accountPage(ctx, { pw = {}, pwErrors = {}, setup = null, setupError = '', disableError = '' } = {}) {
  const s = ctx.session;
  const has2fa = !!s.totp_secret;
  const pwFields = [
    { name: 'current_password', label: 'Current password', type: 'password', required: true, autocomplete: 'current-password' },
    { name: 'new_password', label: 'New password', type: 'password', required: true, hint: 'At least 12 characters, with letters and numbers. A short sentence works well.' },
    { name: 'confirm_password', label: 'Repeat new password', type: 'password', required: true },
  ];
  let twofa;
  if (has2fa) {
    twofa = `<p>${ui.badge('On', 'ok')} You are asked for a code from your authenticator app each time you sign in.</p>
<form method="post" action="/admin/account/2fa/disable" class="stack" data-confirm="Turn off two-factor authentication for your account?">
  ${ui.csrfField(s)}
  ${ui.field({ name: 'disable_password', label: 'Current password (required to turn it off)', type: 'password', required: true, autocomplete: 'current-password' }, '', disableError)}
  <button type="submit" class="btn btn-danger">Turn off two-factor authentication</button>
</form>`;
  } else if (setup) {
    twofa = `<ol class="steps">
  <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) and choose <em>Add account → Enter a setup key</em>.</li>
  <li>Account name: <strong>${h(s.email)}</strong>. Key (time-based):
    <p class="secret" aria-label="Setup key">${h(groupSecret(setup.secret))}</p>
    <details><summary>Show the full setup link instead</summary><label class="sr-only" for="f-uri">Setup link</label><input type="text" id="f-uri" readonly value="${h(setup.uri)}" class="mono" data-select-on-focus></details>
  </li>
  <li>Enter the 6-digit code the app shows to confirm.</li>
</ol>
<form method="post" action="/admin/account/2fa" class="stack">
  ${ui.csrfField(s)}
  <input type="hidden" name="secret" value="${h(setup.secret)}">
  ${ui.field({ name: 'code', label: 'Code from your app', required: true, maxlength: 7, attrs: 'inputmode="numeric" autocomplete="one-time-code"' }, '', setupError)}
  <div class="actions"><button type="submit" class="btn btn-primary">Confirm and turn on</button> <a class="btn" href="/admin/account">Cancel</a></div>
</form>`;
  } else {
    twofa = `<p>${ui.badge('Off', 'warn')} Two-factor authentication adds a second step to sign in using a code from an app on your phone. Strongly recommended for administrators.</p>
<a class="btn btn-primary" href="/admin/account/2fa">Set up two-factor authentication</a>`;
  }
  return layout(ctx, {
    title: 'My account',
    active: 'account',
    body: `${ui.pageHeader('My account', '', `${h(s.name)} · ${h(s.email)}`)}
${ui.notices(ctx.query)}
<section class="panel" aria-labelledby="pw-h">
  <h2 id="pw-h">Change password</h2>
  ${ui.errorSummary(pwErrors)}
  <form method="post" action="/admin/account/password" class="stack narrow">
    ${ui.csrfField(s)}
    ${ui.fields(pwFields, pw, pwErrors)}
    <button type="submit" class="btn btn-primary">Change password</button>
  </form>
</section>
<section class="panel" aria-labelledby="tfa-h">
  <h2 id="tfa-h">Two-factor authentication</h2>
  ${twofa}
</section>`,
  });
}

module.exports = { loginPage, twofaPage, accountPage, groupSecret };
