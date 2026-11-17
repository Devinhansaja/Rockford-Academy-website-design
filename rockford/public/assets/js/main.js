/* Rockford Academy — public site behaviour. No dependencies. Content is rendered on the server. */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  function $(s, c) { return (c || doc).querySelector(s); }
  function $all(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }

  /* Analytics: event names + non-personal parameters only. Never names, emails, phone numbers or CV data. */
  function track(name, params) {
    window.dataLayer = window.dataLayer || [];
    var e = { event: name };
    for (var k in (params || {})) if (Object.prototype.hasOwnProperty.call(params, k)) e[k] = params[k];
    window.dataLayer.push(e);
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('[data-track]');
    if (!a) return;
    var p = {};
    if (a.getAttribute('data-track-item')) p.item = a.getAttribute('data-track-item');
    track(a.getAttribute('data-track'), p);
  });
  $all('[data-analytics-event]').forEach(function (n) {
    var p = {}; try { p = JSON.parse(n.getAttribute('data-analytics-params') || '{}'); } catch (err) { p = {}; }
    track(n.getAttribute('data-analytics-event'), p);
  });

  /* Header */
  var header = $('[data-header]');
  function onScroll() { if (header) header.classList.toggle('is-solid', window.scrollY > 24); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Mobile menu */
  var toggle = $('[data-menu-toggle]');
  var menu = $('[data-mobile-menu]');
  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.menu-toggle__label').textContent = open ? 'Close' : 'Menu';
    header.classList.toggle('menu-open', open);
    doc.body.classList.toggle('no-scroll', open);
    if (open) { menu.hidden = false; requestAnimationFrame(function () { menu.classList.add('is-open'); }); var f = menu.querySelector('a'); if (f) f.focus(); }
    else { menu.classList.remove('is-open'); menu.hidden = true; }
  }
  if (toggle) {
    toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
    doc.addEventListener('keydown', function (e) {
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      if (e.key === 'Escape') { setMenu(false); toggle.focus(); }
      if (e.key === 'Tab') {
        var f = [toggle].concat($all('a', menu)); var i = f.indexOf(doc.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    window.matchMedia('(min-width: 1100px)').addEventListener('change', function (m) { if (m.matches) setMenu(false); });
  }

  /* Headings: split into words for the fade-up reveal */
  $all('[data-split]').forEach(function (node) {
    var text = node.textContent.trim();
    var words = text.split(/\s+/);
    node.setAttribute('aria-label', text);
    node.textContent = '';
    words.forEach(function (w, i) {
      var outer = doc.createElement('span'); outer.className = 'word'; outer.setAttribute('aria-hidden', 'true');
      var inner = doc.createElement('span'); inner.className = 'word__inner'; inner.textContent = w;
      outer.style.setProperty('--i', i); outer.appendChild(inner); node.appendChild(outer);
      if (i < words.length - 1) node.appendChild(doc.createTextNode(' '));
    });
    node.classList.add('split');
  });

  /* Scroll reveals */
  var io = ('IntersectionObserver' in window && !reduceMotion) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }) : null;
  function observe(n) { if (io) io.observe(n); else n.classList.add('is-in'); }
  $all('.ph').forEach(function (ph) { if (!ph.closest('.hero')) ph.classList.add('mreveal'); });
  $all('.reveal, .split, .mreveal, .blue-panel, .carousel').forEach(function (n) {
    if (n.closest('.hero') && !n.classList.contains('mreveal')) return;
    observe(n);
  });
  $all('.carousel .o-card').forEach(function (c, i) { c.style.setProperty('--k', i); });

  /* Development-area tabs + carousel */
  var track$ = $('[data-carousel]');
  if (track$) {
    $all('[data-dim-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-dim-filter');
        $all('[data-dim-filter]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        $all('.o-card', track$).forEach(function (c) { c.hidden = !(f === 'all' || c.getAttribute('data-group') === f); });
        track$.scrollTo({ left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
    var step = function (dir) {
      var card = track$.querySelector('.o-card:not([hidden])');
      track$.scrollBy({ left: dir * (card ? card.getBoundingClientRect().width + 20 : 300), behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    var prev = $('[data-carousel-prev]'); var next = $('[data-carousel-next]');
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });
  }

  /* Generic slash-tab filters for programme / article / vacancy grids */
  $all('[data-filter-group]').forEach(function (group) {
    var target = doc.getElementById(group.getAttribute('data-filter-group'));
    if (!target) return;
    $all('button[data-filter]', group).forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-filter');
        $all('button[data-filter]', group).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        $all('[data-category]', target).forEach(function (c) { c.hidden = !(f === '*' || c.getAttribute('data-category') === f); });
      });
    });
  });

  /* Decorative line fans */
  $all('[data-fan]').forEach(function (svg) {
    var ns = 'http://www.w3.org/2000/svg';
    for (var i = 0; i <= 36; i++) {
      var a = (-90 + i * 2.5) * Math.PI / 180; var len = 150 + (i % 3) * 30;
      var l = doc.createElementNS(ns, 'line');
      l.setAttribute('x1', '20'); l.setAttribute('y1', '220');
      l.setAttribute('x2', String(20 + Math.cos(a) * len)); l.setAttribute('y2', String(220 + Math.sin(a) * len));
      svg.appendChild(l);
    }
  });

  /* Forms: file name + client-side checks (the server re-validates everything) */
  $all('input[type="file"][data-max-bytes]').forEach(function (input) {
    var out = doc.getElementById(input.getAttribute('aria-describedby').split(' ')[0]);
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      input.setCustomValidity('');
      if (!f) return;
      var max = +input.getAttribute('data-max-bytes');
      if (f.size > max) input.setCustomValidity('This file is larger than ' + Math.round(max / 1048576) + ' MB.');
      else if (!/\.(pdf|docx)$/i.test(f.name)) input.setCustomValidity('Please choose a PDF or Word (.docx) file.');
      if (out) out.textContent = 'Selected: ' + f.name + ' (' + Math.max(1, Math.round(f.size / 1024)) + ' KB)';
      input.reportValidity();
    });
  });
  $all('form[data-submit-once]').forEach(function (form) {
    form.addEventListener('submit', function () {
      var b = form.querySelector('[type="submit"]');
      if (b) { b.disabled = true; b.setAttribute('aria-busy', 'true'); b.textContent = 'Sending…'; }
    });
  });

  /* ── Extra motion layer ─────────────────────────────────── */

  // Section labels get a drawn gold rule
  $all('.tiny-label').forEach(function (n) { n.classList.add('rl'); observe(n); });

  // Fan lines draw in, staggered
  $all('[data-fan]').forEach(function (svg) {
    $all('line', svg).forEach(function (l, i) { l.style.setProperty('--li', i); });
    observe(svg);
  });

  // Figures count up from 0 when they come into view
  var counters = $all('.figure__big span');
  function countUp(el) {
    var target = parseInt(el.textContent, 10); var pad = el.textContent.trim().length;
    if (!target || reduceMotion) return;
    var start = null; var dur = 1100;
    var tick = function (t) {
      if (!start) start = t;
      var p = Math.min(1, (t - start) / dur); var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased)).padStart(pad, '0');
      if (p < 1) requestAnimationFrame(tick);
    };
    el.textContent = String(0).padStart(pad, '0');
    requestAnimationFrame(tick);
  }
  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cio.observe(c); });
  }

  // Pointer spotlight on dark cards
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    doc.addEventListener('pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.d-card, .alt-card, .glow, .o-card, .vm2__item');
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  // Scroll-driven: progress bar, hide-on-scroll header, parallax, back-to-top
  var bar = $('[data-progress]');
  var toTop = $('[data-to-top]');
  var parallax = reduceMotion ? [] : $all('.parallax');
  var lastY = window.scrollY; var ticking = false;
  function onFrame() {
    ticking = false;
    var y = window.scrollY; var max = doc.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.setProperty('--sp', max > 0 ? (y / max).toFixed(4) : 0);
    if (header && !header.classList.contains('menu-open') && !header.contains(doc.activeElement)) {
      if (y > 480 && y > lastY + 4) header.classList.add('is-hidden');
      else if (y < lastY - 4 || y < 480) header.classList.remove('is-hidden');
    }
    lastY = y;
    if (toTop) toTop.classList.toggle('is-visible', y > window.innerHeight * 1.2);
    for (var i = 0; i < parallax.length; i++) {
      var r = parallax[i].getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      var progress = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight; // -1 … 1
      var img = parallax[i].querySelector('.ph__img');
      if (img) img.style.setProperty('--py', (progress * -40).toFixed(1) + 'px');
    }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } }, { passive: true });
  onFrame();
  if (toTop) toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    var target = $('#main'); if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
  });

  /* Homepage hero slideshow: crossfade every 6 s, slow zoom (CSS), prev/next, dots, pause/play.
     Pauses when the tab is hidden; starts paused for people who prefer reduced motion. */
  $all('[data-hero-slider]').forEach(function (hero) {
    var slides = $all('[data-slide]', hero);
    var dots = $all('[data-slide-to]', hero);
    var num = $('[data-slide-num]', hero);
    var toggle = $('[data-slide-toggle]', hero);
    if (slides.length < 2) return;
    var ms = parseInt(hero.getAttribute('data-interval'), 10) || 6000;
    hero.style.setProperty('--slide-ms', ms + 'ms');
    var index = 0, timer = null, started = 0, remaining = ms;
    var userPaused = reduceMotion;

    function restartFill(dot) {
      var fill = dot && dot.querySelector('.lux-dot__fill');
      if (!fill) return;
      fill.style.animation = 'none'; void fill.offsetWidth; fill.style.animation = '';
    }
    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) {
        var on = k === index;
        s.classList.toggle('is-active', on);
        if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      });
      dots.forEach(function (d, k) {
        var on = k === index;
        d.classList.toggle('is-active', on);
        if (on) { d.setAttribute('aria-current', 'true'); restartFill(d); } else d.removeAttribute('aria-current');
      });
      if (num) num.textContent = (index < 9 ? '0' : '') + (index + 1);
      remaining = ms;
      schedule();
    }
    function schedule() {
      clearTimeout(timer); timer = null;
      if (userPaused || doc.hidden) return;
      started = Date.now();
      timer = setTimeout(function () { show(index + 1); }, remaining);
    }
    function hold() { // freeze the countdown, remembering how much time is left
      if (timer) { remaining = Math.max(0, remaining - (Date.now() - started)); clearTimeout(timer); timer = null; }
    }
    function setPaused(p) {
      userPaused = p;
      hero.classList.toggle('is-paused', p);
      if (toggle) { toggle.setAttribute('aria-pressed', p ? 'true' : 'false'); toggle.setAttribute('aria-label', p ? 'Play slideshow' : 'Pause slideshow'); }
      if (p) hold(); else schedule();
    }

    var prev = $('[data-slide-prev]', hero), next = $('[data-slide-next]', hero);
    if (prev) prev.addEventListener('click', function () { show(index - 1); });
    if (next) next.addEventListener('click', function () { show(index + 1); });
    dots.forEach(function (d) { d.addEventListener('click', function () { show(parseInt(d.getAttribute('data-slide-to'), 10) || 0); }); });
    if (toggle) toggle.addEventListener('click', function () { setPaused(!userPaused); });
    hero.addEventListener('keydown', function (e) {
      if (!e.target.closest('[data-slider-controls]')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    });
    doc.addEventListener('visibilitychange', function () {
      hero.classList.toggle('is-paused', userPaused || doc.hidden);
      if (doc.hidden) hold(); else schedule();
    });
    // Load the other slides once the first photo is on screen (they start lazy).
    window.addEventListener('load', function () {
      slides.forEach(function (s) { var im = s.querySelector('img[loading="lazy"]'); if (im) im.loading = 'eager'; });
    });

    setPaused(userPaused);
  });

  /* Page-load intro (homepage only; class set in <head> before first paint) */
  requestAnimationFrame(function () { doc.body.classList.add('is-loaded'); });
  if (root.classList.contains('intro')) {
    var played = false;
    var play = function () { if (played) return; played = true; requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('intro-play'); }); }); };
    var heroImg = $('.hero .ph__img');
    if (heroImg && !heroImg.complete) { heroImg.addEventListener('load', play); heroImg.addEventListener('error', play); setTimeout(play, 900); }
    else play();
  }
})();
