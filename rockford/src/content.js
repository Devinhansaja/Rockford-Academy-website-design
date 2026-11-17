'use strict';
/* Read-only public content queries. Only published / open items are ever returned. */
const { q } = require('./db');

const todayColombo = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

module.exports = {
  programmes: () => q.all("SELECT * FROM programmes WHERE status = 'published' ORDER BY sort ASC, title ASC"),
  programme: (slug) => q.get("SELECT * FROM programmes WHERE status = 'published' AND slug = ?", slug),
  programmeById: (id) => q.get("SELECT id, title, slug FROM programmes WHERE status = 'published' AND id = ?", id),

  /** Open vacancies whose deadline (if any) has not passed (Sri Lanka time). */
  vacancies: () => q.all("SELECT * FROM vacancies WHERE status = 'open' AND (deadline = '' OR deadline >= ?) ORDER BY COALESCE(published_at, created_at) DESC", todayColombo()),
  /** Any non-draft vacancy by slug (closed/archived pages stay readable but cannot accept applications). */
  vacancy: (slug) => q.get("SELECT * FROM vacancies WHERE status IN ('open','closed','archived') AND slug = ?", slug),
  vacancyIsOpen: (v) => !!v && v.status === 'open' && (!v.deadline || v.deadline >= todayColombo()),

  testimonials: () => q.all("SELECT * FROM testimonials WHERE status = 'published' AND consent_confirmed = 1 AND approved_by <> '' ORDER BY sort ASC, id DESC"),

  articles: (limit = 100) => q.all("SELECT * FROM articles WHERE status = 'published' AND published_at <= ? ORDER BY published_at DESC LIMIT ?", Date.now(), limit),
  article: (slug) => q.get("SELECT * FROM articles WHERE status = 'published' AND published_at <= ? AND slug = ?", Date.now(), slug),
};
