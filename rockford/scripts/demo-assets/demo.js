/*
 * Rockford design-preview DEMO layer (Vercel only; never used by the real site).
 *
 * The preview is static HTML, so there is no server. This script lets the demo admin work anyway:
 * vacancies and flyers you add, edit or delete are kept in THIS browser (localStorage) and the
 * public pages (home, Careers, vacancy page) are redrawn from them. Nothing is sent anywhere.
 * "/*__SEED__*" below is replaced at build time with the sample data.
 */
(function () {
  'use strict';
  window.__rfDemo = true;
  var KEY = 'rf_demo_v2';
  var SEED = /*__SEED__*/ { vacancies: [], flyers: [] };
  var MAX_BYTES = 1.5 * 1024 * 1024;

  /* ── state ─────────────────────────────────────────── */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function stored() { try { var s = JSON.parse(localStorage.getItem(KEY)); return s && s.vacancies && s.flyers ? s : null; } catch (e) { return null; } }
  var changed = !!stored();
  var state = stored() || clone(SEED);
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); changed = true; return true; } catch (e) { return false; } }
  function nextId(list) { return list.reduce(function (m, x) { return Math.max(m, x.id); }, 0) + 1; }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i]; return null; }

  /* ── helpers ───────────────────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function slugify(s) { return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item'; }
  function today() { return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10); }
  function fmtDate(iso) { if (!iso) return ''; var d = new Date(iso + 'T00:00:00+05:30'); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' }); }
  function lines(s) { return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function inline(s) { return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])_(.+?)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>'); }
  function md(src) {
    var out = [], list = null;
    function close() { if (list) { out.push('</ul>'); list = null; } }
    String(src || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (raw) {
      var l = esc(raw.trim()), m;
      if (!l) { close(); return; }
      if ((m = /^#{2,3}\s+(.*)$/.exec(l))) { close(); out.push('<h2>' + inline(m[1]) + '</h2>'); return; }
      if ((m = /^[-*]\s+(.*)$/.exec(l))) { if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
      close(); out.push('<p>' + inline(l) + '</p>');
    });
    close(); return out.join('');
  }
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function path() { return location.pathname.replace(/\/$/, '').replace(/\.html$/, '') || '/'; }
  function param(n) { return new URLSearchParams(location.search).get(n); }
  var KIND_LABEL = { image: 'Image', pdf: 'PDF', doc: 'Word', text: 'Words' };

  function vacancyLive(v) { return v.status === 'open' && (!v.deadline || v.deadline >= today()); }
  function flyerLive(f) { return f.status === 'published' && (!f.deadline || f.deadline >= today()); }
  function liveVacancies() { return state.vacancies.filter(vacancyLive).sort(function (a, b) { return b.created - a.created; }); }
  function liveFlyers() { return state.flyers.filter(flyerLive).sort(function (a, b) { return a.sort - b.sort || b.created - a.created; }); }
  function jobUrl(v) { return '/careers/job?id=' + v.id; }

  /* Files: seed files have a real URL; files added in the demo are kept as data URLs and opened as blobs. */
  function fileHref(f, mode) { return f.dataUrl ? '#' : f.fileUrl; }
  function fileAttrs(f, mode) { return f.dataUrl ? ' data-demo-file="' + f.id + '" data-demo-mode="' + mode + '"' : ''; }
  function toBlob(dataUrl) {
    var p = dataUrl.split(','), mime = /:(.*?);/.exec(p[0])[1], bin = atob(p[1]), n = bin.length, u = new Uint8Array(n);
    while (n--) u[n] = bin.charCodeAt(n);
    return new Blob([u], { type: mime });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-demo-file]');
    if (!a) return;
    e.preventDefault();
    var f = byId(state.flyers, a.getAttribute('data-demo-file'));
    if (!f || !f.dataUrl) return;
    var url = URL.createObjectURL(toBlob(f.dataUrl));
    if (a.getAttribute('data-demo-mode') === 'download') {
      var d = document.createElement('a'); d.href = url; d.download = f.fileName || 'flyer'; document.body.appendChild(d); d.click(); d.remove();
    } else window.open(url, '_blank');
  });

  /* ── demo bar ──────────────────────────────────────── */
  var bar = document.getElementById('demo-bar'), timer, msg;
  function say(m, warn) {
    if (!bar) return;
    msg = msg || q('#demo-msg', bar);
    if (!msg) return;
    var base = msg.getAttribute('data-base') || msg.textContent;
    msg.setAttribute('data-base', base);
    msg.textContent = m; bar.style.background = warn ? '#C99A43' : '#142747'; bar.style.color = warn ? '#142747' : '#fff';
    clearTimeout(timer); timer = setTimeout(function () { msg.textContent = base; bar.style.background = '#142747'; bar.style.color = '#fff'; }, 4000);
  }
  document.addEventListener('click', function (e) {
    var r = e.target.closest && e.target.closest('[data-demo-reset]');
    if (r) { e.preventDefault(); try { localStorage.removeItem(KEY); } catch (x) {} location.reload(); }
    var u = e.target.closest && e.target.closest('a[data-demo-unavailable]');
    if (u) { e.preventDefault(); say('That page is not part of the demo.', true); }
  });

  /* ── public pages ──────────────────────────────────── */
  function vacancyCard(v) {
    return '<li class="ev-card" data-category="' + esc(v.category) + '"><div class="ev-card__top"><span class="ev-card__date">' + (v.deadline ? 'Closes ' + esc(fmtDate(v.deadline)) : esc(v.employment_type || 'Open')) + '</span>' + (v.category ? '<span class="pill pill--outline">' + esc(v.category) + '</span>' : '') + '</div>' +
      '<h3 class="ev-card__title"><a href="' + jobUrl(v) + '">' + esc(v.title) + '</a></h3>' + (v.summary ? '<p class="ev-card__text">' + esc(v.summary) + '</p>' : '') +
      '<p class="ev-card__meta">' + [v.employment_type, v.location].filter(Boolean).map(esc).join(' · ') + '</p><a class="circle-arrow" href="' + jobUrl(v) + '" aria-label="View vacancy: ' + esc(v.title) + '">→</a></li>';
  }
  function flyerCard(f) {
    var closes = f.deadline ? '<span class="ev-card__date">Closes ' + esc(fmtDate(f.deadline)) + '</span>' : '<span class="ev-card__date">Job flyer</span>';
    var pill = { pdf: 'PDF', doc: 'Word', image: 'Flyer' }[f.kind] || 'Notice';
    var head = '<div class="ev-card__top">' + closes + '<span class="pill pill--outline">' + pill + '</span></div><h3 class="ev-card__title">' + esc(f.title) + '</h3>' + (f.summary ? '<p class="ev-card__text">' + esc(f.summary) + '</p>' : '');
    var src = f.dataUrl || f.fileUrl;
    if (f.kind === 'image' && src) {
      return '<li class="flyer-card flyer-card--image" data-kind="image"><a class="flyer-card__media" href="' + fileHref(f) + '"' + fileAttrs(f, 'open') + ' target="_blank" rel="noopener"><img src="' + esc(src) + '" alt="' + esc(f.alt || f.title) + '"></a>' + head +
        '<a class="pill-btn pill-btn--navy pill-btn--sm" href="' + fileHref(f) + '"' + fileAttrs(f, 'open') + ' target="_blank" rel="noopener">View full flyer</a></li>';
    }
    if (f.kind === 'pdf' && src) {
      return '<li class="flyer-card flyer-card--pdf" data-kind="pdf"><div class="flyer-card__pdf" aria-hidden="true"><span>PDF</span></div>' + head +
        '<div class="flyer-card__actions"><a class="pill-btn pill-btn--navy pill-btn--sm" href="' + fileHref(f) + '"' + fileAttrs(f, 'open') + ' target="_blank" rel="noopener">Open PDF</a> <a class="pill-btn pill-btn--sm pill-btn--outline" href="' + fileHref(f) + '"' + fileAttrs(f, 'download') + ' download>Download</a></div></li>';
    }
    if (f.kind === 'doc' && src) {
      return '<li class="flyer-card flyer-card--doc" data-kind="doc"><div class="flyer-card__pdf" aria-hidden="true"><span>WORD</span></div>' + head +
        '<div class="flyer-card__actions"><a class="pill-btn pill-btn--navy pill-btn--sm" href="' + fileHref(f) + '"' + fileAttrs(f, 'download') + ' download>Download document</a></div></li>';
    }
    return '<li class="flyer-card flyer-card--text" data-kind="text">' + head + '<div class="prose flyer-card__body">' + md(f.body) + '</div></li>';
  }

  function drawCareers() {
    var list = q('#vacancy-list'), vs = liveVacancies();
    if (list) {
      list.innerHTML = vs.length ? vs.map(vacancyCard).join('') : '<li class="ev-card ev-card--empty"><div class="ev-card__top"><span class="ev-card__date">Open positions</span><span class="pill pill--outline">/Coming soon</span></div><h3 class="ev-card__title">New roles will be announced soon</h3><p class="ev-card__text">Please check back shortly.</p></li>';
      var tabs = q('.slash-tabs[data-filter-group="vacancy-list"]'); if (tabs) tabs.style.display = 'none';
      var sub = q('#vacancies .caps-sub'); if (sub) sub.textContent = vs.length ? 'Select a role to read the full description and apply online.' : 'There are no open positions right now. New roles are published here first.';
    }
    var fl = q('#flyers'), fs = liveFlyers();
    if (fl) { fl.style.display = fs.length ? '' : 'none'; var ul = q('ul.flyers', fl); if (ul) ul.innerHTML = fs.map(flyerCard).join(''); }
  }
  function drawHome() {
    var ul = q('ul.vlist'); if (!ul) return;
    var vs = liveVacancies().slice(0, 4);
    ul.innerHTML = vs.length ? vs.map(function (v) {
      return '<li><a href="' + jobUrl(v) + '"><span class="t">' + esc(v.title) + '</span><span class="m">' + [v.employment_type, v.location, v.deadline ? 'Closes ' + fmtDate(v.deadline) : ''].filter(Boolean).map(esc).join(' · ') + '</span><span class="circle-arrow" aria-hidden="true">→</span></a></li>';
    }).join('') : '<li class="empty">New roles will be announced here soon.</li>';
  }
  function drawJob() {
    var v = byId(state.vacancies, param('id')), main = q('main') || document.body;
    if (!v || v.status === 'draft') {
      main.innerHTML = '<section class="section-pad"><div class="wrap"><h1 class="big-title">This vacancy is not available</h1><p class="caps-sub">It may have been removed in the demo admin.</p><a class="pill-btn pill-btn--navy" href="/careers">See open positions</a></div></section>'; return;
    }
    document.title = v.title + ' | Rockford Academy';
    var h1 = q('h1.statement'); if (h1) { h1.removeAttribute('data-split'); h1.textContent = v.title; }
    var lead = q('.lead-row__text'); if (lead) { lead.textContent = v.summary || ''; lead.style.display = v.summary ? '' : 'none'; }
    var prose = q('.detail-grid .prose');
    if (prose) {
      prose.innerHTML = md(v.description) +
        (v.responsibilities.length ? '<h2>Responsibilities</h2><ul class="tick-list">' + v.responsibilities.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        (v.qualifications.length ? '<h2>Required qualifications</h2><ul class="tick-list">' + v.qualifications.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '');
    }
    var open = vacancyLive(v), aside = q('.detail-aside');
    if (aside) {
      var facts = [['Employment type', v.employment_type], ['Location', v.location], ['Category', v.category], ['Closing date', fmtDate(v.deadline)]].filter(function (x) { return x[1]; });
      aside.innerHTML = (facts.length ? '<dl class="facts">' + facts.map(function (x) { return '<div><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
        (open ? '<a class="pill-btn pill-btn--navy" href="#apply">Apply for this role</a>' : '<p>This vacancy is no longer accepting applications.</p><a class="pill-btn pill-btn--navy" href="/careers">See open positions</a>');
    }
    var apply = q('#apply');
    if (apply) { if (open) { var t = q('h2.big-title', apply); if (t) t.textContent = 'Apply for ' + v.title; } else apply.remove(); }
  }

  /* ── admin pages ───────────────────────────────────── */
  var NOTICES = { saved: 'Your changes have been saved.', created: 'Created successfully.', deleted: 'Deleted.', status: 'Status updated.' };
  function notices() {
    var head = q('.page-head'); if (!head) return;
    Object.keys(NOTICES).forEach(function (k) {
      if (param(k) === '1') head.insertAdjacentHTML('afterend', '<div class="alert alert-success" role="status">' + NOTICES[k] + '</div>');
    });
  }
  function badge(text, kind) { return '<span class="badge' + (kind ? ' badge-' + kind : '') + '">' + esc(text) + '</span>'; }
  function statusBadge(s) { var k = { published: 'ok', open: 'ok', draft: 'warn', closed: 'muted', archived: 'muted' }[s] || ''; return badge(s.charAt(0).toUpperCase() + s.slice(1), k); }
  function table(cols, rows, empty) {
    if (!rows.length) return '<p class="empty">' + esc(empty) + '</p>';
    return '<div class="table-wrap"><table><thead><tr>' + cols.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (cell, i) { return i === 0 ? '<th scope="row">' + cell + '</th>' : '<td data-label="' + esc(cols[i]) + '">' + cell + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function replaceTable(html) {
    var old = q('.table-wrap') || q('main p.empty'); var holder = document.createElement('div'); holder.innerHTML = html;
    if (old) old.replaceWith(holder.firstChild); else q('main').appendChild(holder.firstChild);
  }
  function btn(act, id, label, cls) { return '<button type="button" class="btn btn-small' + (cls ? ' ' + cls : '') + '" data-demo-act="' + act + '" data-id="' + id + '">' + esc(label) + '</button>'; }

  function drawAdminDashboard() {
    qa('.stat').forEach(function (s) {
      var label = q('.stat-label', s), val = q('.stat-value', s); if (!label || !val) return;
      if (/Open vacancies/.test(label.textContent)) val.textContent = state.vacancies.filter(function (v) { return v.status === 'open'; }).length;
      if (/Published job flyers/.test(label.textContent)) val.textContent = state.flyers.filter(function (f) { return f.status === 'published'; }).length;
    });
  }
  function drawVacancyList() {
    var rows = state.vacancies.slice().sort(function (a, b) { var o = { open: 0, draft: 1, closed: 2, archived: 3 }; return o[a.status] - o[b.status] || b.created - a.created; }).map(function (v) {
      var toggle = v.status === 'open' ? btn('vstatus', v.id, 'Close') : btn('vstatus', v.id, v.status === 'draft' ? 'Publish (open)' : 'Reopen');
      return ['<a href="/admin/vacancies/new?id=' + v.id + '">' + esc(v.title) + '</a><br><span class="muted small mono">/' + esc(v.slug) + '</span>', statusBadge(v.status),
        esc([v.employment_type, v.location].filter(Boolean).join(' · ')), esc(v.deadline ? fmtDate(v.deadline) : '—'),
        '<div class="row-actions">' + toggle + ' ' + btn('vdelete', v.id, 'Delete', 'btn-danger') + '</div>'];
    });
    replaceTable(table(['Title', 'Status', 'Type', 'Deadline', 'Actions'], rows, 'No vacancies yet.'));
  }
  function drawFlyerList() {
    var rows = state.flyers.slice().sort(function (a, b) { return (a.status === 'published' ? 0 : 1) - (b.status === 'published' ? 0 : 1) || a.sort - b.sort || b.created - a.created; }).map(function (f) {
      var src = f.dataUrl || f.fileUrl;
      return ['<a href="/admin/flyers/new?id=' + f.id + '">' + esc(f.title) + '</a>' + (f.summary ? '<br><span class="muted small">' + esc(f.summary) + '</span>' : ''), badge(KIND_LABEL[f.kind] || f.kind),
        statusBadge(f.status) + (f.status === 'published' && f.deadline && f.deadline < today() ? ' ' + badge('Closing date passed', 'muted') : ''), esc(f.deadline ? fmtDate(f.deadline) : '—'),
        src ? '<a href="' + fileHref(f) + '"' + fileAttrs(f, 'open') + ' target="_blank" rel="noopener">View</a> <span class="muted small">' + Math.max(1, Math.round(f.size / 1024)) + ' KB</span>' : '<span class="muted">—</span>',
        '<div class="row-actions">' + btn('fstatus', f.id, f.status === 'published' ? 'Unpublish' : 'Publish') + ' ' + btn('fdelete', f.id, 'Delete', 'btn-danger') + '</div>'];
    });
    replaceTable(table(['Flyer', 'Type', 'Status', 'Closing date', 'File', 'Actions'], rows, 'No flyers yet. Click “Add flyer” to create the first one.'));
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-demo-act]'); if (!b) return;
    var act = b.getAttribute('data-demo-act'), id = b.getAttribute('data-id'), isV = act.charAt(0) === 'v', list = isV ? state.vacancies : state.flyers, item = byId(list, id); if (!item) return;
    if (act === 'vdelete' || act === 'fdelete') {
      if (!confirm('Delete “' + item.title + '” permanently? This cannot be undone.')) return;
      list.splice(list.indexOf(item), 1); persist(); location.href = (isV ? '/admin/vacancies' : '/admin/flyers') + '?deleted=1'; return;
    }
    item.status = isV ? (item.status === 'open' ? 'closed' : 'open') : (item.status === 'published' ? 'draft' : 'published');
    persist(); location.href = location.pathname + '?status=1';
  });

  function showErrors(form, errs) {
    qa('.demo-errors').forEach(function (n) { n.remove(); });
    if (!errs.length) return;
    var box = document.createElement('div'); box.className = 'alert alert-error demo-errors'; box.setAttribute('role', 'alert'); box.tabIndex = -1;
    box.innerHTML = '<p><strong>Please correct ' + (errs.length === 1 ? 'the problem' : 'these ' + errs.length + ' problems') + ':</strong></p><ul>' + errs.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
    form.parentNode.insertBefore(box, form); box.focus(); box.scrollIntoView({ block: 'center' });
  }
  function val(id) { var el = document.getElementById('f-' + id); return el ? el.value.trim() : ''; }
  function setVal(id, v) { var el = document.getElementById('f-' + id); if (el) el.value = v == null ? '' : v; }
  function dupTitle(list, title, self) { return list.some(function (x) { return x !== self && x.title.toLowerCase() === title.toLowerCase(); }); }

  function setupVacancyForm() {
    var form = q('form.edit-main'), item = byId(state.vacancies, param('id'));
    if (!form) return;
    if (item) {
      q('.page-head h1').textContent = item.title; document.title = 'Edit vacancy · Rockford Admin';
      ['title', 'summary', 'description', 'location', 'category', 'deadline', 'status', 'employment_type'].forEach(function (k) { setVal(k, item[k]); });
      setVal('slug', item.slug); setVal('responsibilities', item.responsibilities.join('\n')); setVal('qualifications', item.qualifications.join('\n'));
      var sb = q('button[type=submit]', form); if (sb) sb.textContent = 'Save changes';
      addAside(form, item, 'vacancy', 'vstatus', 'vdelete', item.status === 'open' ? 'Close' : 'Publish (open)');
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      var errs = [], title = val('title');
      if (!title) errs.push('Title is required.'); else if (title.length > 150) errs.push('Title must be 150 characters or fewer.');
      else if (dupTitle(state.vacancies, title, item)) errs.push('Another vacancy already has this title. Edit that one instead, or choose a different title.');
      if (errs.length) return showErrors(form, errs);
      var v = item || { id: nextId(state.vacancies), created: Date.now() };
      v.title = title; v.summary = val('summary'); v.description = val('description'); v.responsibilities = lines(val('responsibilities')); v.qualifications = lines(val('qualifications'));
      v.employment_type = val('employment_type'); v.location = val('location'); v.category = val('category'); v.deadline = val('deadline'); v.status = val('status') || 'draft';
      var slug = slugify(val('slug') || title); v.slug = slug;
      if (!item) state.vacancies.push(v);
      if (!persist()) return showErrors(form, ['The demo could not save in this browser.']);
      location.href = '/admin/vacancies?' + (item ? 'saved' : 'created') + '=1';
    });
  }

  function addAside(form, item, noun, statusAct, delAct, statusLabel) {
    var grid = form.closest('.edit-grid'); if (!grid) return;
    grid.classList.remove('no-aside');
    grid.insertAdjacentHTML('beforeend', '<aside class="side-panel" aria-label="Actions"><div class="panel"><h2>Status</h2><p>Currently ' + statusBadge(item.status) + '</p><div class="button-row">' + btn(statusAct, item.id, statusLabel) + '</div></div>' +
      '<div class="panel"><h2>Delete</h2><p class="hint">This cannot be undone.</p>' + btn(delAct, item.id, 'Delete ' + noun, 'btn-danger') + '</div></aside>');
  }

  function sniff(buf, name) {
    var b = new Uint8Array(buf), ext = (/\.[^.]+$/.exec(name.toLowerCase()) || [''])[0], hex = function (n) { return Array.prototype.slice.call(b.slice(0, n)).map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); };
    if (hex(3) === 'ffd8ff') return { kind: 'image', mime: 'image/jpeg' };
    if (hex(8) === '89504e470d0a1a0a') return { kind: 'image', mime: 'image/png' };
    if (hex(4) === '52494646' && String.fromCharCode.apply(null, b.slice(8, 12)) === 'WEBP') return { kind: 'image', mime: 'image/webp' };
    if (ext === '.pdf' && String.fromCharCode.apply(null, b.slice(0, 5)) === '%PDF-') return { kind: 'pdf', mime: 'application/pdf' };
    if (ext === '.docx' && hex(4) === '504b0304') return { kind: 'doc', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    if (ext === '.doc' && hex(8) === 'd0cf11e0a1b11ae1') return { kind: 'doc', mime: 'application/msword' };
    return null;
  }
  function sha(buf) { return window.crypto && crypto.subtle ? crypto.subtle.digest('SHA-256', buf).then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }) : Promise.resolve(''); }
  function readAs(file, how) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r[how](file); }); }

  function setupFlyerForm() {
    var form = q('form[data-flyer-form]'), item = byId(state.flyers, param('id'));
    if (!form) return;
    if (item) {
      q('.page-head h1').textContent = item.title; document.title = 'Edit flyer · Rockford Admin';
      setVal('kind', item.kind === 'text' ? 'text' : 'file');
      ['title', 'summary', 'body', 'alt', 'deadline', 'status', 'sort'].forEach(function (k) { setVal(k, item[k]); });
      var kindSel = document.getElementById('f-kind'); if (kindSel) kindSel.dispatchEvent(new Event('change'));
      if (item.kind !== 'text') { var fileBox = document.getElementById('f-file'); if (fileBox) fileBox.closest('.field').insertAdjacentHTML('beforebegin', '<p class="muted small">Current file: ' + esc(item.fileName || 'uploaded file') + '. Choose a new file below only if you want to replace it.</p>'); }
      var sb = q('button[type=submit]', form); if (sb) sb.textContent = 'Save changes';
      addAside(form, item, 'flyer', 'fstatus', 'fdelete', item.status === 'published' ? 'Unpublish' : 'Publish');
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      var errs = [], title = val('title'), kind = val('kind') || 'file', body = val('body'), alt = val('alt'), picked = (document.getElementById('f-file') || {}).files;
      var file = picked && picked[0], text = kind === 'text';
      if (!title) errs.push('Title is required.'); else if (title.length > 150) errs.push('Title must be 150 characters or fewer.');
      else if (dupTitle(state.flyers, title, item)) errs.push('A flyer with this title already exists. Edit that one, or choose a different title.');
      if (text && !body) errs.push('Enter the flyer text.');
      if (!text && !file && !(item && item.kind !== 'text')) errs.push('Choose a file to upload: an image, a PDF or a Word document.');
      if (!text && file && file.size > MAX_BYTES) errs.push('Demo limit: the file must be under 1.5 MB (the live admin allows 8 MB).');
      if (errs.length) return showErrors(form, errs);

      var finish = function (extra) {
        var f = item || { id: nextId(state.flyers), created: Date.now() };
        f.title = title; f.summary = val('summary'); f.deadline = val('deadline'); f.status = val('status') || 'draft'; f.sort = parseInt(val('sort'), 10) || 0;
        if (text) { f.kind = 'text'; f.body = body; f.alt = ''; delete f.fileUrl; delete f.dataUrl; f.fileName = ''; f.size = 0; f.sha = ''; }
        else { if (extra) { f.kind = extra.kind; f.dataUrl = extra.dataUrl; delete f.fileUrl; f.fileName = extra.fileName; f.size = extra.size; f.sha = extra.sha; f.body = ''; } f.alt = f.kind === 'image' ? alt : ''; }
        if (!item) state.flyers.push(f);
        if (!persist()) return showErrors(form, ['The demo could not save in this browser (storage is full). Use a smaller file or click Reset demo.']);
        location.href = '/admin/flyers?' + (item ? 'saved' : 'created') + '=1';
      };
      if (text || !file) {
        if (!text && item && item.kind === 'image' && !alt) return showErrors(form, ['Describe the image (alt text) so it is accessible.']);
        return finish(null);
      }
      readAs(file, 'readAsArrayBuffer').then(function (buf) {
        var found = sniff(buf, file.name);
        if (!found) return showErrors(form, ['That file type is not supported. Upload a JPG, PNG or WebP image, a PDF, or a Word document (.docx or .doc).']);
        if (found.kind === 'image' && !alt) return showErrors(form, ['Describe the image (alt text) so it is accessible.']);
        return sha(buf).then(function (hash) {
          var twin = hash && state.flyers.filter(function (x) { return x !== item && x.sha === hash; })[0];
          if (twin) return showErrors(form, ['This exact file is already uploaded as “' + twin.title + '”. Edit that flyer instead of adding it twice.']);
          return readAs(file, 'readAsDataURL').then(function (dataUrl) { finish({ kind: found.kind, dataUrl: dataUrl, fileName: file.name, size: file.size, sha: hash }); });
        });
      });
    });
  }

  /* ── go ────────────────────────────────────────────── */
  function init() {
    var p = path();
    if (p === '/' && changed) drawHome();
    else if (p === '/careers' && changed) drawCareers();
    else if (p === '/careers/job') drawJob();
    else if (p === '/admin') drawAdminDashboard();
    else if (p === '/admin/vacancies') { drawVacancyList(); notices(); }
    else if (p === '/admin/flyers') { drawFlyerList(); notices(); }
    else if (p === '/admin/vacancies/new') setupVacancyForm();
    else if (p === '/admin/flyers/new') setupFlyerForm();
    if (p === '/' || p.indexOf('/careers') === 0) {
      var pill = document.createElement('div'); pill.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:9998;padding:8px 14px;border-radius:999px;background:#142747;color:#fff;font:600 12px/1.4 Inter,Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)';
      pill.innerHTML = 'Demo: shows what you add in the <a href="/admin/login" style="color:#C99A43">demo admin</a> · <a href="#" data-demo-reset style="color:#C99A43">Reset</a>';
      document.body.appendChild(pill);
    }
  }
  init();
})();
