'use strict';
/*
 * Safe mini-Markdown for staff-edited content. Everything is HTML-escaped first;
 * only this subset is turned into markup: ## / ### headings, paragraphs, - lists,
 * 1. lists, > quotes, **bold**, _italic_, [links](https://…).
 */
const { h, safeUrl } = require('./security');

function inline(s) {
  return h(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const u = safeUrl(url.replace(/&amp;/g, '&'));
      if (!u) return label;
      const ext = /^https?:/i.test(u);
      return `<a href="${h(u)}"${ext ? ' rel="noopener" target="_blank"' : ''}>${label}</a>`;
    });
}

function render(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out = []; let para = []; let list = null;
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    if (!line) { flushPara(); flushList(); continue; }
    if ((m = /^(#{2,3})\s+(.*)$/.exec(line))) { flushPara(); flushList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if ((m = /^[-*]\s+(.*)$/.exec(line))) { flushPara(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = /^\d+[.)]\s+(.*)$/.exec(line))) { flushPara(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = /^>\s?(.*)$/.exec(line))) { flushPara(); flushList(); out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`); continue; }
    flushList(); para.push(line);
  }
  flushPara(); flushList();
  return out.join('\n');
}

/** Plain text (for meta descriptions / emails). */
const plain = (md, max = 160) => {
  const t = String(md || '').replace(/[#>*_`\[\]]/g, '').replace(/\(([^)]+)\)/g, '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
};

module.exports = { render, inline, plain };
