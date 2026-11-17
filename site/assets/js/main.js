/* Rockford Academy — homepage concept. No dependencies. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var data = window.RF_DATA || { settings: {}, programmes: [], vacancies: [], testimonials: [], gallery: [] };
  var settings = data.settings || {};
  var params = new URLSearchParams(location.search);
  var DEMO = params.get('demo') === '1';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  root.classList.add('js');

  /* ── helpers ─────────────────────────────────────────── */
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var node = doc.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'class') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return node;
  }
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; }
  }
  // Analytics: event names and non-personal parameters only. Never PII.
  function track(name, params) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
  }

  /* ── Opportunity Frame ───────────────────────────────── */
  function injectFrame(host) {
    if (host.querySelector(':scope > .oframe')) return;
    var f = el('span', { class: 'oframe oframe--' + (host.getAttribute('data-oframe') || 'inset'), 'aria-hidden': 'true' });
    ['t', 'r', 'b', 'l', 'ct', 'cr', 'ga', 'gb'].forEach(function (p) { f.appendChild(el('i', { class: 'oframe__' + p })); });
    host.appendChild(f);
  }

  /* ── Split headings into words for staggered reveal ─── */
  function splitWords(node) {
    var words = node.textContent.trim().split(/\s+/);
    node.setAttribute('aria-label', node.textContent.trim());
    node.textContent = '';
    words.forEach(function (w, i) {
      var outer = el('span', { class: 'word', 'aria-hidden': 'true' }, [el('span', { class: 'word__inner', text: w })]);
      outer.style.setProperty('--i', i);
      node.appendChild(outer);
      if (i < words.length - 1) node.appendChild(doc.createTextNode(' '));
    });
    node.classList.add('split');
  }

  /* ── Reveal on scroll ────────────────────────────────── */
  var io = null;
  function observe(node) {
    if (!io || reduceMotion) { node.classList.add('is-in'); return; }
    io.observe(node);
  }
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  }

  /* ── Header: transparent over hero → solid on scroll ─── */
  var header = $('[data-header]');
  function onScrollHeader() { header.classList.toggle('is-solid', window.scrollY > 24); }

  /* ── Mobile menu ─────────────────────────────────────── */
  var toggle = $('[data-menu-toggle]');
  var menu = $('[data-mobile-menu]');
  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.menu-toggle__label').textContent = open ? 'Close' : 'Menu';
    header.classList.toggle('menu-open', open);
    doc.body.classList.toggle('no-scroll', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(function () { menu.classList.add('is-open'); });
      var first = menu.querySelector('a'); if (first) first.focus();
    } else {
      menu.classList.remove('is-open');
      menu.hidden = true;
    }
  }
  toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
    // keep focus inside the open menu
    if (e.key === 'Tab' && toggle.getAttribute('aria-expanded') === 'true') {
      var focusables = [toggle].concat($all('a', menu));
      var idx = focusables.indexOf(doc.activeElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); focusables[focusables.length - 1].focus(); }
      else if (!e.shiftKey && idx === focusables.length - 1) { e.preventDefault(); focusables[0].focus(); }
    }
  });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  window.matchMedia('(min-width: 1100px)').addEventListener('change', function (mq) { if (mq.matches) setMenu(false); });

  /* ── Journey progress line ───────────────────────────── */
  var journey = $('[data-journey]');
  var progress = $('[data-journey-progress]');
  var ticking = false;
  function updateJourney() {
    ticking = false;
    if (!journey || !progress) return;
    var r = journey.getBoundingClientRect();
    var vh = window.innerHeight;
    var p = (vh * 0.85 - r.top) / (r.height * 0.75);
    p = Math.max(0, Math.min(1, p));
    progress.style.setProperty('--p', p.toFixed(3));
    $all('.step', journey).forEach(function (s, i, arr) {
      s.classList.toggle('is-active', p >= i / arr.length + 0.02);
    });
  }
  window.addEventListener('scroll', function () {
    onScrollHeader();
    if (!ticking) { ticking = true; requestAnimationFrame(updateJourney); }
  }, { passive: true });

  /* ── Programmes (CMS) ────────────────────────────────── */
  var AVAIL = {
    enrolling: 'Now enrolling', coming_soon: 'Coming soon', waitlist: 'Waitlist open', closed: 'Enrolment closed'
  };
  function programmeCard(p, sample) {
    var meta = el('dl', { class: 'pub-card__meta' });
    [['For', p.audience], ['Duration', p.duration], ['Format', p.format]].forEach(function (m) {
      if (!m[1]) return; // never render empty or invented fields
      meta.appendChild(el('div', null, [el('dt', { text: m[0] }), el('dd', { text: m[1] })]));
    });
    return el('article', { class: 'pub-card reveal', 'data-category': p.category || '' }, [
      el('div', { class: 'pub-card__media' }, [el('div', { class: 'ph', 'aria-hidden': 'true' }, [el('div', { class: 'ph__art' })])]),
      el('div', { class: 'pub-card__chips' }, [
        p.category ? el('span', { class: 'pill pill--outline', text: '/' + p.category }) : null,
        p.availability ? el('span', { class: 'chip chip--' + p.availability, text: AVAIL[p.availability] || p.availability }) : null,
        sample ? el('span', { class: 'chip chip--sample', text: 'Sample' }) : null
      ]),
      el('h3', { class: 'pub-card__title', text: p.title }),
      p.excerpt ? el('p', { class: 'pub-card__text', text: p.excerpt }) : null,
      meta,
      el('div', { class: 'pub-card__actions' }, [
        el('a', { class: 'pill-btn pill-btn--navy pill-btn--sm', href: '/contact/?topic=programmes', 'data-planned': '', 'data-track': 'programme_interest' }, ['Enquire now']),
        el('a', { class: 'circle-arrow', href: '/programmes/', 'data-planned': '', 'aria-label': 'View programme: ' + p.title, text: '↗' })
      ])
    ]);
  }
  function renderProgrammes() {
    var grid = $('[data-programme-grid]');
    var filters = $('[data-programme-filters]');
    var list = data.programmes && data.programmes.length ? data.programmes : (DEMO ? window.RF_SAMPLE.programmes : []);
    var sample = !(data.programmes && data.programmes.length) && DEMO;

    if (!list.length) {
      grid.appendChild($('#tpl-programmes-empty').content.cloneNode(true));
      return;
    }
    if (sample) grid.appendChild(el('p', { class: 'note note--block note--always', text: 'Sample data for layout review only: none of these programmes, durations or statuses are real.' }));
    var cards = el('div', { class: 'pub-grid' });
    list.forEach(function (p) { cards.appendChild(programmeCard(p, sample)); });
    grid.appendChild(cards);

    // Filters only once there are enough programmes to justify them.
    var cats = list.map(function (p) { return p.category; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
    if (list.length >= (settings.programmeFilterThreshold || 4) && cats.length > 1) {
      filters.hidden = false;
      filters.setAttribute('role', 'group');
      filters.setAttribute('aria-label', 'Filter programmes');
      ['All'].concat(cats).forEach(function (c, i) {
        var b = el('button', { type: 'button', class: 'filter', 'aria-pressed': String(i === 0), text: '/' + c });
        b.addEventListener('click', function () {
          $all('.filter', filters).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          $all('.pub-card', cards).forEach(function (card) {
            card.hidden = !(c === 'All' || card.getAttribute('data-category') === c);
          });
        });
        filters.appendChild(b);
      });
    }
  }

  /* ── Vacancies (CMS) ─────────────────────────────────── */
  function renderVacancies() {
    var ul = $('[data-vacancies]');
    var list = data.vacancies && data.vacancies.length ? data.vacancies : (DEMO ? window.RF_SAMPLE.vacancies : []);
    var sample = !(data.vacancies && data.vacancies.length) && DEMO;

    if (!list.length) {
      var eoi = !!settings.expressionOfInterestApproved;
      ul.appendChild(el('li', { class: 'ev-card ev-card--empty reveal' }, [
        el('div', { class: 'ev-card__top' }, [el('span', { class: 'ev-card__date', text: 'Open positions' }), el('span', { class: 'pill pill--outline', text: '/Coming soon' })]),
        el('h3', { class: 'ev-card__title', text: 'New roles will be announced soon' }),
        el('p', { class: 'ev-card__text', text: eoi
          ? 'We are always glad to hear from passionate trainers, educators and professionals. Share your details and we will be in touch.'
          : 'Vacancies will appear here as soon as they are published.' }),
        el('a', { class: 'circle-arrow', href: '/careers/', 'data-planned': '', 'aria-label': eoi ? 'Express your interest' : 'Visit careers', text: '→' })
      ]));
      ul.appendChild(el('li', { class: 'note note--block ev-note', text: 'CMS state: no published vacancies. The general expression-of-interest form switches on only once management approves it (Site Settings).' }));
      return;
    }
    if (sample) ul.appendChild(el('li', { class: 'note note--block note--always ev-note', text: 'Sample roles for layout review only. These are not real vacancies.' }));
    list.forEach(function (v) {
      ul.appendChild(el('li', { class: 'ev-card reveal' }, [
        el('div', { class: 'ev-card__top' }, [
          el('span', { class: 'ev-card__date', text: v.deadline ? 'Closes ' + v.deadline : (v.type || '') }),
          v.category ? el('span', { class: 'pill pill--outline', text: v.category }) : null
        ]),
        el('h3', { class: 'ev-card__title', text: v.title }),
        v.type ? el('p', { class: 'ev-card__text', text: v.type }) : null,
        el('a', { class: 'circle-arrow', href: '/careers/', 'data-planned': '', 'data-track': 'vacancy_view', 'aria-label': 'View vacancy: ' + v.title, text: '→' })
      ]));
    });
  }

  /* ── Gallery ─────────────────────────────────────────── */
  function renderGallery() {
    var ul = $('[data-gallery]');
    (data.gallery || []).slice(0, 4).forEach(function (g, i) {
      var li = el('li', { class: 'stagger__item stagger__item--' + (i + 1) + ' reveal' }, [
        el('figure', { class: 'ph' }, [
          el('div', { class: 'ph__art', 'aria-hidden': 'true' }),
          el('figcaption', { class: 'stagger__cap', text: g.label }),
          el('p', { class: 'ph__note note' }, [el('strong', { text: 'Placeholder' }), ' ' + g.brief])
        ])
      ]);
      li.style.setProperty('--d', (i % 4) * 0.06 + 's');
      ul.appendChild(li);
      putPhoto(li.querySelector('.ph'), g.img, false);
    });
  }

  /* ── Photos (CMS-managed; temporary stock until Rockford photography) ── */
  var STOCK_NOTE = 'Temporary stock photo (Unsplash License). Does not show Rockford students or facilities; replace with authentic Rockford photography before launch.';
  function putPhoto(ph, img, eager) {
    if (!ph || !img || !img.src) return;
    var base = img.src + (img.src.indexOf('?') > -1 ? '&' : '?') + 'auto=format&fit=crop&q=70';
    var tag = el('img', {
      class: 'ph__img',
      src: base + '&w=1400',
      srcset: [640, 1024, 1400, 2000].map(function (w) { return base + '&w=' + w + ' ' + w + 'w'; }).join(', '),
      sizes: ph.classList.contains('ph--hero') || ph.closest('.difference__photo') ? '100vw' : '(min-width: 900px) 50vw, 100vw',
      alt: img.alt || '',
      decoding: 'async'
    });
    if (eager) { tag.setAttribute('fetchpriority', 'high'); } else { tag.setAttribute('loading', 'lazy'); }
    ph.appendChild(tag);
    ph.classList.add('has-img');
    ph.removeAttribute('aria-hidden');
    var note = ph.querySelector('.ph__note') || (ph.parentElement && ph.parentElement.querySelector(':scope > .ph__note'));
    if (note) {
      note.textContent = 'Stock photo · replace before launch';
      note.title = STOCK_NOTE;
      note.classList.add('ph__note--tag');
    }
  }
  function applyImages() {
    var imgs = data.images || {};
    $all('[data-img]').forEach(function (ph) {
      var key = ph.getAttribute('data-img');
      putPhoto(ph, imgs[key], key === 'hero');
    });
  }

  /* ── Development-area tabs + carousel ────────────────── */
  function setupDevelop() {
    var track = $('[data-carousel]');
    if (!track) return;
    $all('[data-dim-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-dim-filter');
        $all('[data-dim-filter]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        $all('.o-card', track).forEach(function (c) { c.hidden = !(f === 'all' || c.getAttribute('data-group') === f); });
        track.scrollTo({ left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
    function step(dir) {
      var card = track.querySelector('.o-card:not([hidden])');
      var w = card ? card.getBoundingClientRect().width + 20 : 300;
      track.scrollBy({ left: dir * w, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    $('[data-carousel-prev]').addEventListener('click', function () { step(-1); });
    $('[data-carousel-next]').addEventListener('click', function () { step(1); });
  }

  /* ── Decorative line fans (gold radiating hairlines) ─── */
  function drawFans() {
    $all('[data-fan]').forEach(function (svg) {
      var ns = 'http://www.w3.org/2000/svg';
      for (var i = 0; i <= 36; i++) {
        var a = (-90 + i * 2.5) * Math.PI / 180;
        var len = 150 + (i % 3) * 30;
        var line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', '20'); line.setAttribute('y1', '220');
        line.setAttribute('x2', String(20 + Math.cos(a) * len));
        line.setAttribute('y2', String(220 + Math.sin(a) * len));
        svg.appendChild(line);
      }
    });
  }

  /* ── Testimonials: hidden until approved content exists ─ */
  function renderStories() {
    var hasStories = data.testimonials && data.testimonials.length;
    $('[data-stories]').hidden = !hasStories;
    $('[data-stories-note]').hidden = !!hasStories;
  }

  /* ── Footer + contact options from confirmed settings ── */
  function renderContact() {
    var c = $('[data-footer-contact]');
    if (settings.email) c.appendChild(el('li', null, [el('a', { href: 'mailto:' + settings.email, text: settings.email })]));
    if (settings.phone) c.appendChild(el('li', null, [el('a', { href: 'tel:' + settings.phone.replace(/\s+/g, ''), text: settings.phone })]));
    if (settings.address) c.appendChild(el('li', { text: settings.address }));
    var social = $('[data-footer-social]');
    (settings.social || []).forEach(function (s) {
      social.appendChild(el('li', null, [el('a', { href: s.url, rel: 'noopener', target: '_blank', text: s.label })]));
    });
    if (settings.whatsapp) {
      $all('[data-whatsapp]').forEach(function (a) {
        a.href = 'https://wa.me/' + String(settings.whatsapp).replace(/\D/g, '');
        a.rel = 'noopener'; a.target = '_blank'; a.hidden = false;
      });
    }
  }

  /* ── Optional hero video (muted, with pause control) ─── */
  function setupHeroVideo() {
    var fig = $('.ph--hero');
    var src = fig && fig.getAttribute('data-video-src');
    if (!src) return;
    var video = el('video', { class: 'hero__video', muted: '', loop: '', playsinline: '', preload: 'none', poster: fig.getAttribute('data-video-poster') || '' });
    video.muted = true;
    video.appendChild(el('source', { src: src, type: 'video/mp4' }));
    fig.insertBefore(video, fig.firstChild);
    var btn = el('button', { type: 'button', class: 'video-toggle', 'aria-pressed': 'false', text: 'Play video' });
    function sync() { var playing = !video.paused; btn.textContent = playing ? 'Pause video' : 'Play video'; btn.setAttribute('aria-pressed', String(playing)); }
    btn.addEventListener('click', function () { video.paused ? video.play() : video.pause(); });
    video.addEventListener('play', sync); video.addEventListener('pause', sync);
    fig.appendChild(btn);
    if (!reduceMotion) video.play().catch(function () {});
  }

  /* ── Concept review controls ─────────────────────────── */
  function setupReview() {
    var t = $('[data-notes-toggle]');
    var saved = store('rf-notes');
    var on = saved === null ? true : saved === '1';
    function apply() {
      doc.body.classList.toggle('show-notes', on);
      t.setAttribute('aria-pressed', String(on));
      t.textContent = 'Review notes: ' + (on ? 'on' : 'off');
    }
    t.addEventListener('click', function () { on = !on; store('rf-notes', on ? '1' : '0'); apply(); });
    apply();
    var demo = $('[data-demo-link]');
    if (DEMO) { demo.href = location.pathname; demo.textContent = 'Show live (empty) CMS state'; }
  }

  var toast = $('[data-toast]'), toastTimer;
  function showToast(msg) {
    toast.textContent = msg; toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 2600);
  }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('a, button');
    if (!a) return;
    var ev = a.getAttribute('data-track');
    if (ev) track(ev, { link_location: (a.closest('section, header, footer') || {}).id || 'page' });
    if (a.hasAttribute('data-planned')) {
      e.preventDefault();
      showToast('This page is part of the next build phase.');
    }
  });

  /* ── init ────────────────────────────────────────────── */
  renderProgrammes();
  renderVacancies();
  renderGallery();
  renderStories();
  renderContact();
  setupHeroVideo();
  setupReview();
  setupDevelop();
  drawFans();
  applyImages();

  $all('[data-split]').forEach(splitWords);
  // reference-style scroll motion targets
  $all('.ph').forEach(function (ph) { if (!ph.closest('.hero')) { ph.classList.add('mreveal'); observe(ph); } });
  $all('.blue-panel, .carousel').forEach(observe);
  $all('.carousel .o-card').forEach(function (c, i) { c.style.setProperty('--k', i); });
  $all('[data-oframe]').forEach(injectFrame);
  $all('.reveal, .split, [data-oframe]').forEach(function (n) {
    if (n.closest('.hero') && !n.hasAttribute('data-oframe')) return; // hero animates on load
    observe(n);
  });
  $all('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });

  onScrollHeader();
  updateJourney();
  // hero lines animate on load
  requestAnimationFrame(function () { doc.body.classList.add('is-loaded'); });

  // Page-load intro: start once the hero photo is ready (max 900ms wait)
  if (root.classList.contains('intro')) {
    var played = false;
    var play = function () { if (played) return; played = true; requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('intro-play'); }); }); };
    var heroImg = $('.hero .ph__img');
    if (heroImg && !heroImg.complete) { heroImg.addEventListener('load', play); heroImg.addEventListener('error', play); setTimeout(play, 900); }
    else { play(); }
  }
})();
