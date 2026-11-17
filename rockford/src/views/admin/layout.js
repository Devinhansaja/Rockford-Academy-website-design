'use strict';
/* Shared admin page shell: sidebar navigation (filtered by role) + top bar. */
const { h } = require('../../security');
const { can } = require('../../auth');
const { csrfField } = require('./ui');

const NAV = [
  { key: 'dashboard', label: 'Dashboard', href: '/admin' },
  { key: 'pages', label: 'Website Pages', href: '/admin/pages', area: 'content' },
  { key: 'programmes', label: 'Programmes', href: '/admin/programmes', area: 'content' },
  { key: 'vacancies', label: 'Vacancies', href: '/admin/vacancies', area: 'recruitment' },
  { key: 'applications', label: 'Applications', href: '/admin/applications', area: 'recruitment' },
  { key: 'enquiries', label: 'Enquiries', href: '/admin/enquiries', area: 'enquiries' },
  { key: 'articles', label: 'News & Articles', href: '/admin/articles', area: 'content' },
  { key: 'testimonials', label: 'Testimonials', href: '/admin/testimonials', area: 'content' },
  { key: 'media', label: 'Media Library', href: '/admin/media', area: 'content' },
  { key: 'settings', label: 'Website Settings', href: '/admin/settings', area: 'settings' },
  { key: 'users', label: 'Users & Permissions', href: '/admin/users', area: 'users' },
  { key: 'audit', label: 'Audit log', href: '/admin/audit', area: 'users' },
  { key: 'account', label: 'My account', href: '/admin/account' },
];

const ROLE_LABEL = { admin: 'Administrator', editor: 'Editor', recruiter: 'Recruiter' };

function head(title) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${h(title)} · Rockford Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/css/admin.css">
<script src="/assets/js/admin.js" defer></script>
</head>`;
}

/** Full admin page. opts: { title, active, body } */
function layout(ctx, { title, active, body }) {
  const s = ctx.session;
  const items = NAV.filter((n) => !n.area || can(s, n.area)).map((n) => `<li><a href="${n.href}"${n.key === active ? ' aria-current="page" class="active"' : ''}>${h(n.label)}</a></li>`).join('');
  const siteName = (ctx.settings && ctx.settings.site_name) || 'Rockford Academy';
  return `${head(title)}
<body class="admin">
<a class="skip-link" href="#main">Skip to main content</a>
<div class="shell">
  <aside class="sidebar" id="sidebar">
    <div class="brand"><a href="/admin"><span class="brand-mark" aria-hidden="true">R</span><span>${h(siteName)}<small>Admin</small></span></a></div>
    <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="admin-nav" hidden>Menu</button>
    <nav id="admin-nav" aria-label="Admin">
      <ul>${items}
        <li><form method="post" action="/admin/logout">${csrfField(s)}<button type="submit" class="nav-button">Log out</button></form></li>
      </ul>
    </nav>
  </aside>
  <div class="main-col">
    <header class="topbar">
      <a class="view-site" href="/" target="_blank" rel="noopener">View website <span aria-hidden="true">↗</span></a>
      <span class="who">${h(s.name)} <span class="role">${h(ROLE_LABEL[s.role] || s.role)}</span></span>
    </header>
    <main id="main" tabindex="-1">
${body}
    </main>
  </div>
</div>
</body>
</html>`;
}

/** Minimal centred page for sign-in screens. */
function bare(ctx, { title, body }) {
  return `${head(title)}
<body class="admin admin-bare">
<main id="main" class="bare-main">
  <div class="bare-card">
    <div class="brand brand-dark"><span class="brand-mark" aria-hidden="true">R</span><span>${h((ctx.settings && ctx.settings.site_name) || 'Rockford Academy')}<small>Staff sign in</small></span></div>
${body}
  </div>
</main>
</body>
</html>`;
}

module.exports = { layout, bare, NAV, ROLE_LABEL };
