'use strict';
/*
 * Email. Transports:
 *  - "outbox" (default): nothing is delivered. Messages are written to storage/outbox/*.eml so
 *    they can be inspected, and the admin dashboard shows "Email delivery not configured".
 *  - "smtp": real delivery through an SMTP server (Google Workspace, Microsoft 365, SES, Postmark…).
 * send() never throws: it resolves { delivered, transport, error? }. Callers must not tell users
 * an email was sent unless `delivered` is true.
 */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const tls = require('node:tls');
const crypto = require('node:crypto');
const config = require('./config');

const configured = () => config.mail.transport === 'smtp' && !!config.mail.host && !!config.mail.from;

const clean = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();
const encodeHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`);

function buildMessage({ to, subject, text, replyTo }) {
  const from = clean(config.mail.from || 'Rockford Academy <no-reply@localhost>');
  const domain = (/@([^>\s]+)/.exec(from) || [, 'localhost'])[1];
  const headers = [
    `From: ${from}`,
    `To: ${[].concat(to).map(clean).join(', ')}`,
    `Subject: ${encodeHeader(clean(subject))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  if (replyTo) headers.push(`Reply-To: ${clean(replyTo)}`);
  const body = Buffer.from(String(text).replace(/\r?\n/g, '\r\n')).toString('base64').replace(/(.{76})/g, '$1\r\n');
  return headers.join('\r\n') + '\r\n\r\n' + body + '\r\n';
}

function writeOutbox(msg, meta) {
  const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}.eml`;
  fs.writeFileSync(path.join(config.DATA_DIR, 'outbox', name), `X-Rockford-Transport: outbox (not delivered)\r\nX-Rockford-Purpose: ${clean(meta)}\r\n` + msg);
}

/** Minimal SMTP client: EHLO, STARTTLS or implicit TLS, AUTH LOGIN, MAIL/RCPT/DATA. */
function smtpSend(recipients, msg) {
  const { host, port, secure, user, pass, from } = config.mail;
  const envelopeFrom = (/<([^>]+)>/.exec(from) || [, from])[1].trim();
  return new Promise((resolve, reject) => {
    let socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    socket.setTimeout(20000, () => { socket.destroy(new Error('SMTP timeout')); });
    let buffer = '';
    let waiter = null;
    const onData = (d) => {
      buffer += d.toString('utf8');
      const lines = buffer.split('\r\n');
      // A complete reply ends with a line "NNN text" (space after code).
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) {
          const reply = lines.slice(0, i + 1).join('\n');
          buffer = lines.slice(i + 1).join('\r\n');
          const w = waiter; waiter = null;
          if (w) w(reply);
          return;
        }
      }
    };
    const expect = (code) => new Promise((res, rej) => {
      waiter = (reply) => (reply.startsWith(String(code)) ? res(reply) : rej(new Error(`SMTP: expected ${code}, got ${reply.slice(0, 200)}`)));
    });
    const cmd = (line, code) => { const p = expect(code); socket.write(line + '\r\n'); return p; };
    const attach = (s) => { s.on('data', onData); s.on('error', reject); };
    attach(socket);

    (async () => {
      await expect(220);
      let ehlo = await cmd('EHLO rockford.local', 250);
      if (!secure && /STARTTLS/i.test(ehlo)) {
        await cmd('STARTTLS', 220);
        socket.removeListener('data', onData);
        socket = tls.connect({ socket, servername: host });
        attach(socket);
        await new Promise((r) => socket.once('secureConnect', r));
        ehlo = await cmd('EHLO rockford.local', 250);
      } else if (!secure && user) {
        throw new Error('SMTP server does not offer STARTTLS; refusing to send credentials in plain text.');
      }
      if (user) {
        await cmd('AUTH LOGIN', 334);
        await cmd(Buffer.from(user).toString('base64'), 334);
        await cmd(Buffer.from(pass).toString('base64'), 235);
      }
      await cmd(`MAIL FROM:<${envelopeFrom}>`, 250);
      for (const r of recipients) await cmd(`RCPT TO:<${(/<([^>]+)>/.exec(r) || [, r])[1].trim()}>`, 250);
      await cmd('DATA', 354);
      const dotStuffed = msg.replace(/\r\n\./g, '\r\n..');
      await cmd(dotStuffed + '\r\n.', 250);
      socket.write('QUIT\r\n');
      socket.end();
      resolve();
    })().catch((e) => { try { socket.destroy(); } catch { /* ignore */ } reject(e); });
  });
}

/**
 * Send a plain-text email. `to` may be a string or array.
 * Resolves { delivered: boolean, transport, error? }.
 */
async function send({ to, subject, text, replyTo, purpose = '' }) {
  const recipients = [].concat(to).map((s) => String(s || '').trim()).filter((s) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s));
  if (!recipients.length) return { delivered: false, transport: 'none', error: 'No valid recipient configured' };
  const msg = buildMessage({ to: recipients, subject, text, replyTo });
  if (!configured()) {
    writeOutbox(msg, purpose);
    return { delivered: false, transport: 'outbox' };
  }
  try {
    await smtpSend(recipients, msg);
    return { delivered: true, transport: 'smtp' };
  } catch (e) {
    console.error('[mail] delivery failed:', e.message);
    writeOutbox(msg, `FAILED ${purpose}: ${e.message}`);
    return { delivered: false, transport: 'smtp', error: e.message };
  }
}

module.exports = { send, configured, buildMessage };
