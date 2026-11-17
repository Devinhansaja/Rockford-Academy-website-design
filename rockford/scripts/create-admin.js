#!/usr/bin/env node
'use strict';
/*
 * Create an administrator account.
 *   Interactive:      node scripts/create-admin.js
 *   Non-interactive:  node scripts/create-admin.js --name "Jane Perera" --email jane@example.com --password "…"
 * Respects DATA_DIR (and .env) like the server, so it writes to the same database.
 */
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w); });

const readline = require('node:readline');
const { q, now, audit } = require('../src/db');
const { hashPassword, passwordProblem } = require('../src/security');

const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--(name|email|password)(?:=(.*))?$/.exec(argv[i]);
    if (!m) {
      if (argv[i] === '--help' || argv[i] === '-h') out.help = true;
      continue;
    }
    out[m[1]] = m[2] !== undefined ? m[2] : argv[++i];
  }
  return out;
}

function validate({ name, email, password }) {
  if (!name || name.length > 100) return 'Enter a name (up to 100 characters).';
  if (!EMAIL_RE.test(email || '')) return 'Enter a valid email address.';
  if (q.get('SELECT id FROM users WHERE email = ?', email)) return `A user with the email ${email} already exists.`;
  const p = passwordProblem(password || '');
  if (p) return `Password: ${p}`;
  return '';
}

function create({ name, email, password }) {
  const r = q.run('INSERT INTO users (email, name, role, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)', email, name, 'admin', hashPassword(password), now());
  audit(null, 'user.create', `#${r.lastInsertRowid} ${name} <${email}> as admin (command line)`);
  console.log(`\nAdministrator created: ${name} <${email}>. Sign in at /admin/login`);
}

/** Ask a question; when `hidden`, typed characters are not echoed. */
function ask(rl, question, hidden = false) {
  return new Promise((resolve) => {
    if (!hidden) return rl.question(question, (a) => resolve(a.trim()));
    const out = rl.output;
    const orig = rl._writeToOutput;
    rl._writeToOutput = (s) => { if (s.includes(question)) out.write(s); else if (/\r|\n/.test(s)) out.write('\n'); };
    rl.question(question, (a) => { rl._writeToOutput = orig; resolve(a); });
  });
}

async function interactive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
  try {
    console.log('Create a Rockford Academy administrator\n');
    const name = await ask(rl, 'Full name: ');
    const email = (await ask(rl, 'Email address: ')).toLowerCase();
    for (;;) {
      const password = await ask(rl, 'Password (12+ characters, letters and numbers): ', !!process.stdin.isTTY);
      const confirm = await ask(rl, 'Repeat password: ', !!process.stdin.isTTY);
      if (password !== confirm) { console.log('The passwords do not match. Try again.'); continue; }
      const problem = validate({ name, email, password });
      if (problem && problem.startsWith('Password:')) { console.log(problem); continue; }
      if (problem) { console.error(problem); process.exitCode = 1; return; }
      create({ name, email, password });
      return;
    }
  } finally { rl.close(); }
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log('Usage: node scripts/create-admin.js [--name "Full Name" --email you@example.com --password "…"]');
} else if (args.email || args.name || args.password) {
  const v = { name: String(args.name || '').trim(), email: String(args.email || '').trim().toLowerCase(), password: String(args.password || '') };
  const problem = validate(v);
  if (problem) { console.error(problem); process.exitCode = 1; } else create(v);
} else {
  interactive().catch((e) => { console.error(e); process.exitCode = 1; });
}
