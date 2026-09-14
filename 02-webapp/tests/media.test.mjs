import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
import { entryScreen } from '../src/entry-screen.js';
const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const media = JSON.parse(read('src/content/media.json'));

test('website gateway paths open the correct authentication screen', () => {
  assert.equal(entryScreen('/login'), 'login');
  assert.equal(entryScreen('/login/'), 'login');
  assert.equal(entryScreen('/signup'), 'signup');
  assert.equal(entryScreen('/signup/'), 'signup');
  assert.equal(entryScreen('/'), 'landing');
  assert.equal(entryScreen('/unknown'), 'landing');
});

test('all media slots resolve to supplied files with descriptive alt text', () => {
  assert.match(media.basePath, /^\/assets\/[a-z0-9-]+\/$/);
  for (const image of Object.values(media.images)) {
    assert.match(image.file, /^[a-zA-Z0-9_.-]+\.(jpg|png)$/);
    assert.ok(image.alt.length > 20);
    assert.ok(statSync(new URL('public' + media.basePath + image.file, root)).size > 1000);
  }
  for (const key of [...Object.values(media.slots), ...media.gallery.map(item => item.image)]) {
    assert.ok(media.images[key], `Missing media: ${key}`);
  }
  assert.ok(statSync(new URL('public' + media.basePath + media.video.file, root)).size > 1000);
  assert.doesNotMatch(read('src/App.jsx'), /alp-(hero-learning-support|plan-review|family-meeting)\.webp/);
});

test('shared credit renders a secure, clickable link in the app shell and offline page', async () => {
  const result = await build({ entryPoints: [new URL('src/components/BrandCredit.jsx', root).pathname],
    bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'], loader: { '.css': 'empty' } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  const React = require('react');
  const html = require('react-dom/server').renderToStaticMarkup(React.createElement(module.exports.default));
  for (const markup of [html, read('public/offline.html')]) {
    const document = new JSDOM(markup).window.document;
    const link = document.querySelector('footer a');
    assert.equal(link.href, 'https://www.stanparaclete.com/');
    assert.equal(link.textContent, 'Stan Paraclete');
    assert.match(link.rel, /noopener/);
  }
  assert.match(read('src/App.jsx'), /<\/ErrorBoundary>\s*<BrandCredit\/>/);
});
