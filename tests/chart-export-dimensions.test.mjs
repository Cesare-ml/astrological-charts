import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/renderers/chart-export-dimensions.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
}).outputText;
const {validateChartExportDimensions: validate, MAX_CHART_EXPORT_EDGE: maxEdge,
  MAX_CHART_EXPORT_PIXELS: maxPixels} = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);

test('normal PNG export sizes and positive fractional pixel ratios remain valid', () => {
  assert.equal(validate({x:1080,y:1080},2), undefined);
  assert.equal(validate({x:800,y:800},2), undefined);
  assert.equal(validate({x:4096,y:2048},1.5), undefined);
  assert.equal(validate({x:1920,y:1080},1), undefined);
  assert.equal(validate({x:1,y:1},1), undefined);
  assert.equal(validate({x:maxEdge,y:4096},1), undefined);
  assert.equal(maxPixels,32*1024*1024);
});

test('invalid dimensions fail before canvas creation', () => {
  for (const dimension of [
    null, undefined, {}, {x:0,y:100}, {x:-1,y:100},
    {x:100,y:0}, {x:100,y:-1}, {x:10.5,y:100},
    {x:100,y:99.5}, {x:NaN,y:100}, {x:Infinity,y:100},
    {x:100,y:-Infinity}, {x:'800',y:600},
    {x:9007199254740992,y:100},
  ]) assert.throws(() => validate(dimension,1), RangeError, String(dimension));
});

test('invalid scale and nonfinite scaled pixels fail', () => {
  for (const scale of [
    0, -1, -Infinity, Infinity, NaN, undefined, null, '2',
    1e308, 0.000001,
  ]) assert.throws(() => validate({x:1080,y:1080},scale), RangeError, String(scale));
});

test('oversized output is bounded by both edge and total pixel budget', () => {
  assert.equal(maxEdge,8192);
  assert.throws(() => validate({x:8193,y:1},1), /pixel budget/);
  assert.throws(() => validate({x:4097,y:4096},2), /pixel budget/);
  assert.throws(() => validate({x:8192,y:4097},1), /pixel budget/);
  assert.throws(() => validate({x:8000,y:8000},1), /pixel budget/);
  assert.equal(validate({x:8192,y:4096},1),undefined);
  assert.equal(validate({x:4096,y:4096},1),undefined);
});

test('render service validates before acquiring the queue or constructing offscreen WebGL', () => {
  const service = readFileSync(new URL('../src/lib/services/grafico-render.service.ts', import.meta.url), 'utf8');
  assert.match(service, /import \{ validateChartExportDimensions \} from '\.\.\/renderers\/chart-export-dimensions';/);
  const method = service.slice(service.indexOf('public async generaImmagine('),
    service.indexOf('private async generaImmagineInterna('));
  const checkIndex = method.indexOf('validateChartExportDimensions(dimensioni, scala)');
  const queueIndex = method.indexOf('GraficoRenderService.runExclusive(');
  assert.ok(checkIndex !== -1 && queueIndex > checkIndex,
    'Reject invalid exports before globally serializing them');
});
