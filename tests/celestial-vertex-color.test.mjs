import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const colorsSource = readFileSync(new URL('../src/lib/renderers/_colori.config.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(colorsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { Colori } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('renderer lowercase vertex and legacy Vertex resolve to the same color', () => {
  assert.equal(Colori.elementiCelesti.vertex, '#FEFEFE');
  assert.equal(Colori.elementiCelesti.vertex, Colori.elementiCelesti.Vertex);
});

test('vertex identifier agrees with the chart setting and element renderer', () => {
  const settings = readFileSync(new URL('../src/lib/models/settaggi.model.ts', import.meta.url), 'utf8');
  const renderer = readFileSync(new URL('../src/lib/renderers/moduli/elementi-celesti.renderer.ts', import.meta.url), 'utf8');
  assert.match(settings, /public vertex:\s*SettaggiElementoCeleste/);
  assert.match(renderer, /case 'vertex':/);
  assert.match(renderer, /initElementoCeleste\('vertex'/);
});

test('existing color palette retains representative planet and axis mappings', () => {
  for (const [key, expected] of Object.entries({
    Sun: '#FF0000', Moon: '#C0C0C0', 'true Node': '#FFC247',
    AS: '#ed6e00', DS: '#02a958', MC: '#6600a1', IC: '#a99cd7',
  })) {
    assert.equal(Colori.elementiCelesti[key], expected, key);
  }
  for (const [key, value] of Object.entries(Colori.elementiCelesti)) {
    assert.match(value, /^#[0-9a-f]{6}$/i, key);
  }
});
