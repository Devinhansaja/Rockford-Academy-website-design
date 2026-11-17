'use strict';
/* Verifies the built-in SMTP client against a local fake SMTP server (no network needed). */
const test = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

test('SMTP client delivers a message through the SMTP conversation', async () => {
  const received = { rcpt: [], data: '' };
  const server = net.createServer((sock) => {
    let inData = false; let buf = '';
    sock.write('220 fake.smtp ready\r\n');
    sock.on('data', (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\r\n')) > -1) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) {
          if (line === '.') { inData = false; sock.write('250 queued\r\n'); } else received.data += line + '\n';
          continue;
        }
        if (/^EHLO/i.test(line)) sock.write('250-fake.smtp\r\n250 8BITMIME\r\n');
        else if (/^MAIL FROM/i.test(line)) { received.from = line; sock.write('250 ok\r\n'); }
        else if (/^RCPT TO/i.test(line)) { received.rcpt.push(line); sock.write('250 ok\r\n'); }
        else if (/^DATA/i.test(line)) { inData = true; sock.write('354 go\r\n'); }
        else if (/^QUIT/i.test(line)) { sock.write('221 bye\r\n'); sock.end(); }
        else sock.write('500 ?\r\n');
      }
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-mail-'));
  Object.assign(process.env, {
    DATA_DIR: dir, MAIL_TRANSPORT: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port),
    SMTP_SECURE: 'false', SMTP_USER: '', MAIL_FROM: 'Rockford Academy <no-reply@example.com>',
  });
  const mail = require('../src/mail');
  const res = await mail.send({ to: 'person@example.com', subject: 'Test ✓', text: 'Hello\n.leading dot line' });
  server.close();
  assert.strictEqual(res.delivered, true, JSON.stringify(res));
  assert.match(received.from, /<no-reply@example.com>/);
  assert.deepStrictEqual(received.rcpt, ['RCPT TO:<person@example.com>']);
  assert.match(received.data, /Subject: =\?UTF-8\?B\?/);
  fs.rmSync(dir, { recursive: true, force: true });
});
