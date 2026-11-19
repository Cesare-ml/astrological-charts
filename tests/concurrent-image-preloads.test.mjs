import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Run the real TypeScript image-preload logic with a deterministic Image test
// double. No network, Angular, WebGL or real artwork is required.
const source = readFileSync(new URL('../src/lib/renderers/gestore-immagini.ts', import.meta.url), 'utf8');
const urlSource = readFileSync(new URL('../src/lib/renderers/chart-asset-urls.ts', import.meta.url), 'utf8');
const combined = [
  'const SkinManager = { skins: {} };',
  'const THREE = {};',
  urlSource.replace('export function resolveChartAssetUrl', 'function resolveChartAssetUrl'),
  source.replace(/^import .*\r?\n/gm, ''),
].join('\n');
const compiled = ts.transpileModule(combined, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { GestoreImmagini } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);

const originalImage = globalThis.Image;
const created = [];
let failToAssignSrc = false;
class FakeImage {
  onload = null;
  onerror = null;
  _src = '';
  constructor() { created.push(this); }
  set src(url) {
    if (failToAssignSrc) throw new Error('Cannot assign image source');
    this._src = url;
  }
  get src() { return this._src; }
}
globalThis.Image = FakeImage;
after(() => {
  if (originalImage === undefined) delete globalThis.Image;
  else globalThis.Image = originalImage;
});

test('deduplicates aliases within a call and shares pending requests across calls', async () => {
  const first = GestoreImmagini.preloadImages([
    'Sun.png', '../../../assets/img/Sun.png', 'img/Moon.png',
  ]);
  const second = GestoreImmagini.preloadImages(['assets/img/Sun.png']);
  assert.deepEqual(created.map(img => img.src), ['/assets/img/Sun.png', '/assets/img/Moon.png']);
  created[0].onload();
  created[1].onload();
  assert.deepEqual(await first, [undefined, undefined]);
  assert.deepEqual(await second, [undefined]);
});

test('successful requests are evicted so a later redraw can load again', async () => {
  const start = created.length;
  const loading = GestoreImmagini.preloadImages(['Sun.png']);
  assert.equal(created.length, start + 1);
  created.at(-1).onload();
  assert.deepEqual(await loading, [undefined]);
});

test('concurrent failures propagate to both callers and can retry', async () => {
  const start = created.length;
  const first = GestoreImmagini.preloadImages(['Mercury.png']);
  const second = GestoreImmagini.preloadImages(['assets/img/Mercury.png']);
  assert.equal(created.length, start + 1);
  created.at(-1).onerror();
  const failures = await Promise.allSettled([first, second]);
  assert.deepEqual(failures.map(result => result.status), ['rejected', 'rejected']);
  for (const failure of failures) assert.match(String(failure.reason), /Mercury\.png/);

  const again = GestoreImmagini.preloadImages(['Mercury.png']);
  assert.equal(created.length, start + 2);
  created.at(-1).onload();
  await again;
});

test('a different configured asset base has an independent in-flight URL', async () => {
  const first = GestoreImmagini.preloadImages(['Venus.png']);
  GestoreImmagini.configurePublicAssetsBase('/preview/assets/');
  const second = GestoreImmagini.preloadImages(['Venus.png']);
  assert.equal(created.at(-2).src, '/assets/img/Venus.png');
  assert.equal(created.at(-1).src, '/preview/assets/img/Venus.png');
  created.at(-2).onload();
  created.at(-1).onload();
  await Promise.all([first, second]);
});

test('synchronous image-source failures evict the pending entry and permit retry', async () => {
  failToAssignSrc = true;
  await assert.rejects(GestoreImmagini.preloadImages(['Jupiter.png']), /Cannot assign image source/);
  failToAssignSrc = false;
  const start = created.length;
  const retry = GestoreImmagini.preloadImages(['Jupiter.png']);
  assert.equal(created.length, start + 1);
  created.at(-1).onload();
  await retry;
});

test('an empty preload list does not instantiate images', async () => {
  const start = created.length;
  assert.deepEqual(await GestoreImmagini.preloadImages([]), []);
  assert.equal(created.length, start);
});
