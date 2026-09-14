const path = require('node:path');
const TRUSTED_ORIGINS = new Set(['https://growwithalp.com', 'https://app.growwithalp.com']);
const EXTERNAL_ORIGINS = new Set([...TRUSTED_ORIGINS, 'https://www.stanparaclete.com', 'https://stanparaclete.com']);
function parsed(value) { try { return new URL(value); } catch { return null; } }
function appURL(value, development = false) {
  const url = parsed(value);
  if (!url || url.username || url.password) throw new Error('Invalid ALP application URL.');
  if (!TRUSTED_ORIGINS.has(url.origin) && !(development && url.protocol === 'http:' && url.hostname === '127.0.0.1')) throw new Error('Untrusted ALP application origin.');
  return url.href;
}
function sameApp(value, base) {
  const url = parsed(value);
  return Boolean(url && !url.username && !url.password && url.origin === new URL(base).origin);
}
function externalURL(value) {
  const url = parsed(value);
  return url && !url.username && !url.password && EXTERNAL_ORIGINS.has(url.origin) ? url.href : null;
}
function downloadName(value) {
  const name = path.basename(String(value)).replace(/[^A-Za-z0-9._ -]/g, '_').slice(-140);
  return /\.(pdf|docx|csv|txt|png|jpe?g)$/i.test(name) ? name : null;
}
function trustedDownload(value, base) {
  const url = parsed(value);
  return sameApp(value, base) || Boolean(url?.protocol === 'blob:' && url.origin === new URL(base).origin);
}
function trustedShell(event, shellContents) {
  return event.sender === shellContents && event.senderFrame === shellContents.mainFrame && event.senderFrame.url === 'alp://desktop/index.html';
}
module.exports = { appURL, sameApp, externalURL, downloadName, trustedDownload, trustedShell };
