import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Fast, browser-free contract against the ACTUAL Angular demo source.
// Browser/WebGL focus and camera invariants are tested separately by the
// opt-in axis-keyboard-focus.browser.test.mjs gate.
const source = readFileSync(new URL('../demo/main.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('demo/main.ts', source, ts.ScriptTarget.ES2022,
  true, ts.ScriptKind.TS);
assert.equal(ast.parseDiagnostics.length, 0, 'Angular demo must parse as TypeScript');
const component = ast.statements.find(node =>
  ts.isClassDeclaration(node) && node.name?.text === 'DemoComponent');
assert.ok(component, 'Missing Angular DemoComponent');

function member(name, predicate) {
  const node = component.members.find(entry =>
    predicate(entry) && entry.name?.getText(ast) === name);
  assert.ok(node, 'Missing demo member: ' + name);
  return node.getText(ast);
}

const decorator = (ts.getDecorators(component) ?? []).find(node =>
  ts.isCallExpression(node.expression) &&
  node.expression.expression.getText(ast) === 'Component');
assert.ok(decorator, 'Missing Angular @Component decorator');
const metadata = decorator.expression.arguments[0];
assert.ok(ts.isObjectLiteralExpression(metadata), 'Missing Angular component metadata');
const templateNode = metadata.properties.find(prop =>
  ts.isPropertyAssignment(prop) && prop.name.getText(ast) === 'template');
assert.ok(templateNode && ts.isNoSubstitutionTemplateLiteral(templateNode.initializer),
  'Angular demo template must remain inline to run this fast contract');
const template = templateNode.initializer.text;
const AXES = ['AS', 'DS', 'MC', 'IC'];

function keyboardProbe() {
  const source = [
    'class KeyboardDemoProbe {',
    "planetLayer: string = 'natal';",
    'selectedPlanet: any = null;',
    'busy = false;',
    'calls: any[] = [];',
    'checks = 0;',
    'zoomCalls = 0;',
    'renderer = {highlightPlanet: (value: any) => this.calls.push(value)};',
    'changes = {markForCheck: () => {this.checks++;}};',
    'zoom(_step: number) {this.zoomCalls++;}',
    member('bodies', ts.isPropertyDeclaration),
    member('changePlanetLayer', ts.isMethodDeclaration),
    member('selectPlanet', ts.isMethodDeclaration),
    member('clearPlanet', ts.isMethodDeclaration),
    '}'
  ].join('\n');
  const compiled = ts.transpileModule(source, {compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None
  }});
  assert.deepEqual((compiled.diagnostics ?? []).filter(d =>
    d.category === ts.DiagnosticCategory.Error), []);
  const Demo = new Function('demoBodies', compiled.outputText +
    '\nreturn KeyboardDemoProbe;')(['Sun', 'Moon']);
  return new Demo();
}

test('four native axis buttons are in a keyboard-operable and labelled list', () => {
  const button = template.match(/<button\b[^>]*class="planet-button"[^>]*>/s)?.[0];
  assert.ok(button, 'Missing template planet selection button');
  for (const contract of [
    /\*ngFor="let body of bodies"/,
    /type="button"/,
    /\[disabled\]="busy"/,
    /\[attr\.aria-label\]="[^"]*planetLayer[^"]*body[^"]*"/,
    /\[attr\.aria-pressed\]="[^"]*selectedPlanet\?\.layer[^"]*planetLayer[^"]*selectedPlanet\?\.name[^"]*body[^"]*"/,
    /\(click\)="selectPlanet\(body\)"/
  ]) assert.match(button, contract, 'Keyboard/ARIA button contract missing');
  assert.doesNotMatch(button, /\btabindex=|\[attr\.tabindex\]=/,
    'Do not remove axis buttons from native Tab order');

  const layer = template.match(/<select\b[^>]*id="planet-layer"[^>]*>/s)?.[0];
  assert.ok(layer && layer.includes('(change)="changePlanetLayer($event)"'),
    'Chart-layer select must remain a native keyboard control');
  assert.match(template, /<option value="natal">Natal chart<\/option>/);
  assert.match(template, /<option \*ngIf="mode === 'transits'" value="transit">Transits<\/option>/);

  const clear = template.match(/<button\b[^>]*id="clear-focus"[^>]*>/s)?.[0];
  assert.ok(clear && clear.includes('(click)="clearPlanet()"'),
    'Clear focus must be available as a native button');
});

test('actual demo methods keep natal/transit axis identities separate without zoom', () => {
  const demo = keyboardProbe();
  assert.deepEqual(demo.bodies.slice(-4), AXES);
  assert.equal(new Set(demo.bodies).size, demo.bodies.length);

  for (const axis of AXES) {
    demo.selectPlanet(axis);
    assert.deepEqual(demo.selectedPlanet, {layer:'natal', name:axis});
    assert.deepEqual(demo.calls.at(-1), {layer:'natal', name:axis});
  }
  assert.equal(demo.calls.length, AXES.length);
  demo.changePlanetLayer({target:{value:'transit'}});
  assert.equal(demo.planetLayer, 'transit');
  demo.selectPlanet('AS');
  assert.deepEqual(demo.selectedPlanet, {layer:'transit', name:'AS'});
  assert.deepEqual(demo.calls.at(-1), {layer:'transit', name:'AS'});
  demo.changePlanetLayer({target:{value:'natal'}});
  demo.selectPlanet('AS');
  assert.deepEqual(demo.calls.at(-1), {layer:'natal', name:'AS'});
  assert.equal(demo.zoomCalls, 0, 'Selection must not request zoom');
  assert.equal(demo.checks, 8, 'Every selection/layer switch marks the view');
});

test('clear focus sends explicit null and busy state ignores further selection', () => {
  const demo = keyboardProbe();
  demo.selectPlanet('MC');
  demo.clearPlanet();
  assert.equal(demo.selectedPlanet, null);
  assert.equal(demo.calls.at(-1), null);
  demo.busy = true;
  demo.selectPlanet('IC');
  assert.equal(demo.selectedPlanet, null);
  assert.deepEqual(demo.calls, [{layer:'natal', name:'MC'}, null]);
  assert.equal(demo.zoomCalls, 0);
});
