import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

test('reentrant material disposal cannot overwrite a newer natal aspect palette', () => {
  const src = ts.createSourceFile('planet-interaction.controller.ts',
    readFileSync(new URL('../src/lib/renderers/planet-interaction.controller.ts',import.meta.url),'utf8'),
    ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const cls = src.statements.find(node =>
    ts.isClassDeclaration(node) && node.name?.text === 'PlanetInteractionController');
  const method = cls?.members.find(node =>
    ts.isMethodDeclaration(node) && node.name.getText(src) === 'clearVisuals');
  assert.ok(method?.body,'actual controller cleanup method must exist');
  const compiled = ts.transpileModule(`class PaletteProbe {
    glyphMaterialOverrides = new Map();
    natalLineColors = new Map();
    natalFocusOverlays: any[] = [];
    lines: any[] = [];
    transitGuides = new Map();
    ${method.getText(src)}
  }`,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const Probe = new Function(compiled + '\nreturn PaletteProbe;')();

  for (const interleaved of [false,true]) {
    const probe = new Probe();
    const originalColor = [1,0,0];
    const oldMutedColor = [0.5,0.5,0.5];
    const nextFocusedColor = [0,0,1];
    const attribute = {
      values: oldMutedColor.slice(),
      count: 1,
      needsUpdate: false,
      ...(interleaved ? {data: {needsUpdate:false}} : {}),
      setXYZ(index,r,g,b) {
        assert.equal(index,0);
        this.values = [r,g,b];
      }
    };
    const base = {disposed:0,dispose(){this.disposed++;}};
    let cloneDisposals = 0;
    let observedAtDispose;
    let reentered = false;
    const clone = {dispose() {
      cloneDisposals++;
      observedAtDispose = attribute.values.slice();
      // Mimic the synchronous host callback that repaints another planet.
      // A new paint snapshots the *already restored native colors*.
      assert.equal(probe.natalLineColors.size,0,
        'old ownership was detached before emitting dispose');
      reentered = true;
      probe.clearVisuals(); // nested cleanup is legal and must be a no-op
      const baseline = attribute.values.slice();
      probe.natalLineColors.set(attribute,baseline);
      attribute.setXYZ(0,...nextFocusedColor);
    }};
    const mesh = {material:clone};
    probe.glyphMaterialOverrides.set(mesh,{original:base,focused:clone});
    probe.natalLineColors.set(attribute,originalColor.slice());
    probe.clearVisuals();

    assert.equal(reentered,true);
    assert.equal(cloneDisposals,1,'old focus clone must dispose exactly once');
    assert.equal(mesh.material,base,'old mesh baseline remains intact');
    assert.equal(base.disposed,0,'never dispose host-owned materials');
    assert.deepEqual(observedAtDispose,originalColor,
      'native line color must be restored before callback triggers new focus');
    assert.deepEqual(attribute.values,nextFocusedColor,
      'older cleanup must not overwrite a newer focus tint');
    assert.deepEqual(probe.natalLineColors.get(attribute),originalColor,
      'newer focus must preserve the true original color snapshot');
    assert.equal(interleaved ? attribute.data.needsUpdate : attribute.needsUpdate,true);

    probe.clearVisuals();
    assert.deepEqual(attribute.values,originalColor,
      'subsequent cleanup restores native colors from the newer paint');
    assert.equal(probe.natalLineColors.size,0);
    assert.equal(cloneDisposals,1);
  }
});
