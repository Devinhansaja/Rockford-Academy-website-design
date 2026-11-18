/* Rockford admin – small progressive enhancements. Everything works without this file. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    // Confirm before destructive actions: <form data-confirm="…"> or <button data-confirm="…">
    document.addEventListener('submit', function (e) {
      var form = e.target;
      var msg = form.getAttribute && form.getAttribute('data-confirm');
      if (msg && !window.confirm(msg)) e.preventDefault();
    });
    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('button[data-confirm], a[data-confirm]');
      if (el && !window.confirm(el.getAttribute('data-confirm'))) e.preventDefault();
    });

    // Mobile navigation toggle
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('admin-nav');
    if (toggle && nav) {
      toggle.hidden = false;
      nav.classList.add('collapsed');
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('collapsed') === false;
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    // Slug preview: show the slug that will be generated from the title when the slug field is empty
    var source = document.querySelector('[data-slug-source]');
    var target = document.querySelector('[data-slug-target]');
    function slugify(s) {
      return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    }
    if (source && target) {
      var update = function () { target.placeholder = source.value ? slugify(source.value) + ' (automatic)' : ''; };
      source.addEventListener('input', update);
      update();
      // Tidy a hand-typed slug when the field loses focus ("My Course!" → "my-course")
      target.addEventListener('change', function () { if (target.value) target.value = slugify(target.value); });
    }

    // Show the chosen file name and a preview for image uploads
    Array.prototype.forEach.call(document.querySelectorAll('input[type=file][data-filename]'), function (input) {
      var out = document.createElement('p');
      out.className = 'file-name';
      out.setAttribute('aria-live', 'polite');
      input.insertAdjacentElement('afterend', out);
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        out.textContent = f ? 'Selected: ' + f.name + ' (' + Math.max(1, Math.round(f.size / 1024)) + ' KB)' : '';
      });
    });

    // Job flyer form: show only the fields that fit the chosen flyer type (image / pdf / text)
    var flyerForm = document.querySelector('[data-flyer-form]');
    if (flyerForm) {
      var kindSelect = flyerForm.querySelector('#f-kind');
      var showFor = function () {
        Array.prototype.forEach.call(flyerForm.querySelectorAll('[data-kind-show]'), function (box) {
          var on = box.getAttribute('data-kind-show').split(' ').indexOf(kindSelect.value) !== -1;
          box.hidden = !on;
        });
      };
      if (kindSelect) { kindSelect.addEventListener('change', showFor); showFor(); }
    }

    // Copy buttons and select-on-focus for read-only URL fields
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-copy]');
      if (!btn) return;
      var input = document.getElementById(btn.getAttribute('data-copy'));
      if (!input) return;
      input.select();
      var done = function () { var t = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = t; }, 1500); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(input.value).then(done, function () {});
      else { try { document.execCommand('copy'); done(); } catch (err) { /* user can copy manually */ } }
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-select-on-focus]'), function (el) {
      el.addEventListener('focus', function () { el.select(); });
    });

    // Character counters for fields with a maxlength under 400 (e.g. SEO fields)
    Array.prototype.forEach.call(document.querySelectorAll('input[maxlength], textarea[maxlength]'), function (el) {
      var max = parseInt(el.getAttribute('maxlength'), 10);
      if (!max || max > 400 || el.readOnly || el.type === 'password' || el.type === 'search') return;
      var c = document.createElement('p');
      c.className = 'char-count';
      c.setAttribute('aria-hidden', 'true');
      el.insertAdjacentElement('afterend', c);
      var upd = function () { c.textContent = el.value.length + ' / ' + max; c.classList.toggle('over', el.value.length >= max); };
      el.addEventListener('input', upd);
      upd();
    });

    // Move focus to the error summary after a failed save
    var summary = document.querySelector('[data-autofocus]');
    if (summary) summary.focus();
  });
})();
