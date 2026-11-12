import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Tests the actual TypeScript resolver without importing Angular or Three.js.
// This script runs locally after npm install; it does not access the network.
const source = readFileSync(new URL('../src/lib/renderers/chart-asset-urls.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { resolveChartAssetUrl: resolve } = await import(
  'data:text/javascript;base64,' + Buffer.from(output).toString('base64')
);

test('legacy and modern paths resolve to one canonical URL', () => {
  const expected = '/assets/img/simboli-bianchi/segni/01.png';
  for (const ref of [
    'simboli-bianchi/segni/01.png',
    '../../../assets/img/simboli-bianchi/segni/01.png',
    'assets/img/simboli-bianchi/segni/01.png',
    '/assets/img/simboli-bianchi/segni/01.png',
  ]) assert.equal(resolve(ref), expected);
});

test('skin texture, fonts and resonator share host assets', () => {
  assert.equal(resolve('assets/img/textures/texture-oro-3.webp'), '/assets/img/textures/texture-oro-3.webp');
  assert.equal(resolve('/assets/fonts/my-font.json'), '/assets/fonts/my-font.json');
  assert.equal(resolve('risuonatore-solare-vetro-satinato.png'), '/assets/img/risuonatore-solare-vetro-satinato.png');
});

test('configured roots support development previews and a CDN', () => {
  assert.equal(
    resolve('simboli-bianchi/case/01.png', 'https://static.example.org/virgo/assets'),
    'https://static.example.org/virgo/assets/img/simboli-bianchi/case/01.png',
  );
  assert.equal(resolve('/assets/img/x.png', '/preview/assets/'), '/preview/assets/img/x.png');
});

test('external absolute URLs and unrelated host paths remain unchanged', () => {
  for (const ref of [
    'https://example.org/a.png',
    'file:///opt/astrolabio/assets/img/a.png',
    'data:image/png;base64,AAA',
    'blob:https://example.org/123',
    '/images/manual.png',
  ]) assert.equal(resolve(ref), ref);
});

test('refuses unknown traversal and malformed asset references', () => {
  for (const ref of ['../private.txt', './private.txt', 'assets/img/../secret.png', 'img/../../unsafe.png', '']) {
    assert.throws(() => resolve(ref));
  }
});

test('host-owned asset references reject percent-encoded traversal and control bytes', () => {
  // URL parsers may turn encoded dot segments into real ".." after resolution.
  for (const ref of [
    'assets/img/%2e%2e/secret.png',
    'img/.%2e/private.png',
    'img/%2fetc/passwd.png',
    'img/a%5cb.png',
    'img/planet?.png',
    'img/planet#.png',
    'img/planet:alt.png',
    'fonts/%00font.json',
    'img/%25%32e%25%32e/secret.png',
    'img/a\u0000.png',
  ]) assert.throws(() => resolve(ref), /Invalid chart asset path/);
});

test('literal spaces and caller-controlled absolute URLs remain compatible', () => {
  assert.equal(
    resolve('img/simboli-bianchi/elementi-celesti/mean Apogee.png'),
    '/assets/img/simboli-bianchi/elementi-celesti/mean Apogee.png',
  );
  assert.equal(
    resolve('https://static.example.org/asset%20pack/Sun.png'),
    'https://static.example.org/asset%20pack/Sun.png',
  );
});
