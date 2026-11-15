import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(file, 'utf8');
const demo = source('demo/main.ts');
const styles = source('demo/styles.css');
const elements = source('src/lib/renderers/moduli/elementi-celesti.renderer.ts');
const aspects = source('src/lib/renderers/moduli/aspetti.renderer.ts');
const mirror = source('src/lib/renderers/moduli/zodiacal-projections.renderer.ts');
const scene = source('src/lib/renderers/@carta-astrale/carta-astrale.renderer.ts');
const service = source('src/lib/services/grafico-render.service.ts');
const primitives = source('src/lib/renderers/oggetti-semplici.renderer.ts');
const model = source('src/lib/models/opzioni-grafico.model.ts');

test('demo hosts three exclusive buttons on a single row', () => {
  assert.match(demo, /zodiac-toolbar/);
  assert.match(demo, /Dodecatemori ×13/);
  assert.match(demo, /Contrantisci/);
  assert.match(demo, /reflectionAxis/);
  assert.match(demo, /aria-label/);
  assert.match(styles, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /color:\s*#101010/);
});

test('new option is additive and scene delegates to an isolated renderer', () => {
  assert.match(model, /proiezioneZodiacale\?: ZodiacProjectionSelection/);
  assert.match(scene, /ZodiacalProjectionsRenderer\.create\(/);
  assert.match(scene, /creaZodiacalProjections/);
  assert.match(scene, /if \(stato\.opzioni\.dodecatemoriAttivi/);
});

test('dodecatemori show colored dots in all mode and a single arrow/glyph', () => {
  assert.match(elements, /storedDodecatemorion\(/);
  assert.match(elements, /new THREE\.CircleGeometry\(radius/);
  assert.match(elements, /raggioConfineAnelloPianeti - radius/);
  assert.match(elements, /lanciaFrecciaAdArco\(/);
  assert.match(aspects, /nameA === markerName \|\| nameB === markerName/);
  assert.match(aspects, /nodi\[j\]\.name\.endsWith\('-dodecatemoria'\)/);
});

test('Regolo mirror renders distinct triangles and dashed red radial lines, no derived aspects', () => {
  assert.match(mirror, /getLineaGrossa\(natalPoint, targetPoint, planetColor, 0\.6\)/);
  assert.match(mirror, /getLineaGrossa\(targetPoint, origin, planetColor, 0\.6\)/);
  assert.match(mirror, /getLineaGrossa\(origin, natalPoint, planetColor, 0\.6\)/);
  assert.match(mirror, /getLineaGrossaTratteggiata\(/);
  assert.match(mirror, /'#f60a09'/);
  assert.match(mirror, /new THREE\.CircleGeometry\(markerRadius/);
  assert.match(mirror, /new THREE\.RingGeometry\(markerRadius/);
  assert.doesNotMatch(aspects, /-proiezione-/);
});

test('one cancellable animation loop, motion reduction and static export', () => {
  assert.match(elements, /userData\.pulseZodiacalProjection = true/);
  assert.match(mirror, /userData\.pulseZodiacalProjection = true/);
  assert.match(service, /stopGlyphPulse\(\)/);
  assert.match(service, /requestAnimationFrame\(tick\)/);
  assert.match(service, /prefers-reduced-motion: reduce/);
  assert.match(service, /generaImmagineInterna\(/);
});

test('short dashed radial segments cannot divide by zero', () => {
  assert.match(primitives, /distanza <= 0/);
  assert.match(primitives, /passo <= 0/);
  assert.match(primitives, /Math\.max\(2, Math\.ceil\(distanza \/ passo \/ 2\) \* 2\)/);
});
