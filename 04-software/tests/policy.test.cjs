const test = require('node:test');
const assert = require('node:assert/strict');
const { appURL, sameApp, externalURL, downloadName, trustedDownload, trustedShell } = require('../src/policy.cjs');
const base = 'https://growwithalp.com/login';
test('production origins reject credentials, insecure URLs and lookalike hosts', () => {
  assert.equal(appURL(base), base);
  for (const url of ['http://growwithalp.com', 'https://growwithalp.com.evil.test', 'https://evil.test', 'https://a:b@growwithalp.com', 'file:///etc/passwd', 'javascript:alert(1)']) assert.throws(() => appURL(url));
  assert.throws(() => appURL('http://127.0.0.1:3000'));
  assert.equal(appURL('http://127.0.0.1:3000', true), 'http://127.0.0.1:3000/');
});
test('navigation and external links use parsed exact origins', () => {
  assert.ok(sameApp('https://growwithalp.com/students', base));
  assert.equal(sameApp('https://app.growwithalp.com', base), false);
  assert.equal(externalURL('https://www.stanparaclete.com/'), 'https://www.stanparaclete.com/');
  for (const url of ['javascript:alert(1)', 'file:///tmp/a', 'https://www.stanparaclete.com.evil.test', 'https://evil.test']) assert.equal(externalURL(url), null);
});
test('downloads require a trusted origin and non-executable filename', () => {
  assert.equal(downloadName('../../Plan.pdf'), 'Plan.pdf');
  for (const name of ['app.exe', 'script.js', 'plan.pdf.exe', 'installer.dmg']) assert.equal(downloadName(name), null);
  assert.ok(trustedDownload('blob:https://growwithalp.com/123', base));
  assert.equal(trustedDownload('blob:https://evil.test/123', base), false);
});
test('IPC denies remote content and subframes', () => {
  const frame = { url: 'alp://desktop/index.html' };
  const shell = { mainFrame: frame };
  assert.ok(trustedShell({ sender: shell, senderFrame: frame }, shell));
  assert.equal(trustedShell({ sender: {}, senderFrame: frame }, shell), false);
  assert.equal(trustedShell({ sender: shell, senderFrame: { url: frame.url } }, shell), false);
  frame.url = 'https://growwithalp.com/';
  assert.equal(trustedShell({ sender: shell, senderFrame: frame }, shell), false);
});
