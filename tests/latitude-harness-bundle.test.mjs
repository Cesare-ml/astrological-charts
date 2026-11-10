import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

// The latitude Playwright probe bundles this same fixture at runtime.
// Catch stale imports and TypeScript/esbuild failures in preflight, without
// starting Angular, an HTTP asset server, or a WebGL browser.
test('latitude browser harness bundles the real renderer and synthetic fixture', {timeout: 60000}, async () => {
  const result = await build({
    entryPoints: ['tests/fixtures/latitude-zero-render-harness.ts'],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    tsconfig: 'tsconfig.json',
    metafile: true,
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.outputFiles.length, 1);
  assert.match(result.outputFiles[0].text, /runZeroLatitudeRenderProbe/);

  const sources = Object.keys(result.metafile.inputs).map(path => path.replaceAll('\\', '/'));
  for (const required of [
    'tests/fixtures/latitude-zero-render-harness.ts',
    'demo/fixtures.ts',
    'src/lib/services/grafico-render.service.ts',
    'src/lib/renderers/@carta-astrale/latitudini.renderer.ts',
  ]) {
    assert.ok(sources.some(path => path.endsWith(required)),
      `expected real source to be included in browser harness bundle: ${required}`);
  }
});
