import test from 'node:test';
import assert from 'node:assert/strict';
import { maskTypeScriptComments, collectActiveAssetLines } from '../scripts/active-asset-lines.mjs';

test('preserves active asset expressions around multiline and same-line comments', () => {
  const source = [
    `/* getImg('fake.png') */ const first = 'assets/img/real.png';`,
    `const second = 'assets/img/two.png'; /* asset hidden */`,
    `/*\n getImg('not-live.png')\n*/ const third = 'assets/img/three.png';`,
    `// getImg('not-live.png')`,
  ].join('\n');
  assert.deepEqual(collectActiveAssetLines(source, 'src/test.ts').map(({line, expression}) => [line, expression]), [
    [1, "const first = 'assets/img/real.png';"],
    [2, "const second = 'assets/img/two.png';"],
    [5, "const third = 'assets/img/three.png';"],
  ]);
  assert.equal(maskTypeScriptComments(source).split('\n').length, source.split('\n').length);
});

test('does not mistake comment markers in URLs, regexp and interpolated templates for comments', () => {
  const source = [
    `const url = 'https://example.test/assets/img/full.png'; // fake.png`,
    String.raw`const rule = /\/\//; const logo = 'assets/img/logo.png';`,
    'const ring = `assets/img/${planet}/circle.png`; // hidden.png',
    'const more = `assets/img/${ /* skip.png */ name}/Sun.png`;',
    `// getImg('ignored.png')`,
  ].join('\n');
  const rows = collectActiveAssetLines(source, 'src/other.ts');
  assert.deepEqual(rows.map(row => row.line), [1, 2, 3, 4]);
  assert.ok(rows[0].expression.includes('https://example.test/assets/img/full.png'));
  assert.ok(rows[2].expression.includes('assets/img/${planet}/circle.png'));
  assert.ok(rows[3].expression.includes('assets/img/${'));
  assert.ok(!rows[3].expression.includes('skip.png'));
  assert.equal(rows[2].kind, 'dynamic');
});

test('reports active lines after block comments without changing line numbers', () => {
  const source = "/* fake.png\r\n fake2.png */\r\ngetImg('live.png');\r\n";
  const masked = maskTypeScriptComments(source);
  assert.equal(masked.length, source.length);
  assert.deepEqual(collectActiveAssetLines(source, 'f.ts').map(row => row.line), [3]);
});
