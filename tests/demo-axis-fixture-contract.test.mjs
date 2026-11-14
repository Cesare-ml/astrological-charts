import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';

/**
 * Fast contract for synthetic natal AS/DS/MC/IC endpoints and Angular demo
 * options. Not a browser canvas, raycast, camera or visual parity test.
 */
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
async function loadModule(path) {
  const output = ts.transpileModule(read(path), {compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext
  }}).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
}
const {demoCrossChartAspects: links} = await loadModule('demo/interaction-fixtures.ts');
const aspectApi = await loadModule('src/lib/renderers/planet-interaction.types.ts');
const {Colori} = await loadModule('src/lib/renderers/_colori.config.ts');
const axes = ['AS', 'DS', 'MC', 'IC'];
const partners = {AS:'Neptune', DS:'Mars', MC:'Neptune', IC:'Mercury'};

const ast = ts.createSourceFile('demo/main.ts',read('demo/main.ts'),
  ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
const component = ast.statements.find(node =>
  ts.isClassDeclaration(node) && node.name?.text === 'DemoComponent');
assert.ok(component,'DemoComponent must be available');

function member(name, predicate) {
  const node = component.members.find(entry =>
    predicate(entry) && entry.name?.getText(ast) === name);
  assert.ok(node,'Missing actual demo member: ' + name);
  return node.getText(ast);
}

const demoBodies = ['Sun','Moon']; // minimal synthetic options probe
const defaults = {
  settaggi: {skin_id:'previous', elementi_celesti:
    Object.fromEntries([...demoBodies,...axes].map(name =>
      [name,{att:false,aspVerso:false}]))},
  temaGrafico:'previous',mostraTransiti:false,mostraSinastria:false
};
const probeTs = [
  'class DemoAxisProbe {',
  "mode: string = 'transits';",
  "skin: string = 'light';",
  "planetLayer: string = 'natal';",
  "aspectFilter: 'all' | 'hard' = 'all';",
  'selectedPlanet: any = null;',
  'busy = false;',
  'calls: any[] = [];',
  'renderer = {highlightPlanet: (planet: any) => this.calls.push(planet)};',
  'changes = {markForCheck() {}};',
  member('bodies',ts.isPropertyDeclaration),
  member('visibleCrossChartAspects',ts.isGetAccessorDeclaration),
  member('options',ts.isMethodDeclaration),
  member('selectPlanet',ts.isMethodDeclaration),
  '}'
].join('\n');
const probeJs = ts.transpileModule(probeTs, {compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None
}}).outputText;
const DemoAxisProbe = new Function('demoBodies','demoCrossChartAspects',
  'defaultOpzioniGrafico',probeJs + '\nreturn DemoAxisProbe;')(
    demoBodies,links,defaults
  );

test('four natal axes each have exactly one supplied synthetic transit aspect', () => {
  const angleLinks = links.filter(link =>
    axes.includes(link.from.name) || axes.includes(link.to.name));
  assert.equal(angleLinks.length,4,'do not duplicate or omit axis links');
  for (const name of axes) {
    const found = angleLinks.filter(link =>
      link.to.layer === 'natal' && link.to.name === name);
    assert.equal(found.length,1,name + ': missing/duplicate relation');
    const link = found[0];
    assert.deepEqual(link.from,{layer:'transit',name:partners[name]});
    assert.equal(link.type,'semiquadrato',name);
    assert.ok(Number.isFinite(link.orb) && link.orb >= 0);
  }
});

test('actual relation selector is bidirectional and preserves axis layer', () => {
  for (const name of axes) {
    const natal = {layer:'natal',name};
    const transit = {layer:'transit',name};
    const found = aspectApi.relatedChartAspects(natal,links);
    assert.equal(found.length,1);
    assert.deepEqual(aspectApi.relatedChartAspects(found[0].from,links)
      .filter(link => link.to.name === name),found);
    assert.deepEqual(aspectApi.relatedChartAspects(transit,links),[]);
  }
});

test('actual demo filter hides axis semisquares and restores them', () => {
  const demo = new DemoAxisProbe();
  assert.equal(demo.visibleCrossChartAspects,links);
  demo.aspectFilter = 'hard';
  const hard = demo.visibleCrossChartAspects;
  assert.ok(hard.length > 0,'hard-only filter must retain other hard links');
  assert.ok(hard.every(link =>
    link.type === 'quadrato' || link.type === 'opposizione'));
  for (const name of axes) assert.equal(
    aspectApi.relatedChartAspects({layer:'natal',name},hard).length,0);
  demo.aspectFilter = 'all';
  for (const name of axes) assert.equal(
    aspectApi.relatedChartAspects(
      {layer:'natal',name},demo.visibleCrossChartAspects).length,1);
});

test('actual demo options expose all four axes and do not mutate defaults', () => {
  const demo = new DemoAxisProbe();
  assert.deepEqual(demo.bodies.slice(-4),axes);
  assert.equal(new Set(demo.bodies).size,demo.bodies.length);
  const options = demo.options();
  for (const name of axes) {
    assert.equal(options.settaggi.elementi_celesti[name].att,true,name);
    assert.equal(options.settaggi.elementi_celesti[name].aspVerso,true,name);
    assert.equal(defaults.settaggi.elementi_celesti[name].att,false);
  }
  assert.equal(options.mostraTransiti,true);
  demo.mode = 'natal';
  assert.equal(demo.options().mostraTransiti,false);
});

test('actual frontend selection of all axes does not call zoom', () => {
  const demo = new DemoAxisProbe();
  for (const name of axes) {
    demo.selectPlanet(name);
    assert.deepEqual(demo.selectedPlanet,{layer:'natal',name});
    assert.deepEqual(demo.calls.at(-1),{layer:'natal',name});
  }
  assert.equal(demo.calls.length,4);
  demo.busy = true;
  demo.selectPlanet('Sun');
  assert.equal(demo.calls.length,4);
});

test('the four axes have explicit, distinct focus colors', () => {
  for (const name of axes)
    assert.match(Colori.elementiCelesti[name],/^#[0-9a-f]{6}$/i);
  assert.equal(new Set(axes.map(name =>
    Colori.elementiCelesti[name].toLowerCase())).size,axes.length);
});
