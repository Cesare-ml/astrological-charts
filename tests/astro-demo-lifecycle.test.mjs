import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Exercise the actual lifecycle, render, rollback and PNG-export TypeScript
// methods from the Angular demo with a deferred renderer. No Angular, DOM,
// browser, image, font or private asset pack is needed.
const source=readFileSync(new URL('../demo/main.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('demo/main.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const component=ast.statements.find(node=>
  ts.isClassDeclaration(node)&&node.name?.text==='DemoComponent'
);
assert.ok(component,'DemoComponent must exist');
const names=['ngOnDestroy','draw','drawWithPreviewRecovery','exportPng','showError'];
const methods=names.map(name=>{
  const method=component.members.find(node=>
    ts.isMethodDeclaration(node)&&node.name.getText(ast)===name
  );
  assert.ok(method,'Demo lifecycle method missing: '+name);
  return method.getText(ast);
});
const compiled=ts.transpileModule('class LifecycleHarness {\n'+methods.join('\n')+'\n}',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
}).outputText;

function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
  return {promise,resolve,reject};
}
function harness(){
  const pendingDraws=[],pendingExports=[],flags=[];
  let destroyed=0,marks=0,clicked=0;
  const manager={
    configureVirgoStarsAstroPreview:enabled=>flags.push(enabled),
  };
  const document={
    createElement:tag=>{
      assert.equal(tag,'a');
      return {click:()=>clicked++};
    },
  };
  const Constructor=new Function('GestoreImmagini','document',
    compiled+'\nreturn LifecycleHarness;'
  )(manager,document);
  const instance=new Constructor();
  instance.destroyed=false;
  instance.drawRequest=0;
  instance.renderRevision=0;
  instance.astroPreviewEnabled=true;
  instance.previewNotice='';
  instance.busy=false;
  instance.status='Preparing';
  instance.error='';
  instance.mode='natal';
  instance.skin='light';
  instance.radix={};
  instance.transit=null;
  instance.synastry=null;
  instance.options=()=>({});
  instance.changes={markForCheck:()=>marks++};
  instance.renderer={
    disegnaScena:()=>{const d=deferred();pendingDraws.push(d);return d.promise;},
    generaImmagine:()=>{const d=deferred();pendingExports.push(d);return d.promise;},
    ngOnDestroy:()=>{destroyed++;},
  };
  return {instance,pendingDraws,pendingExports,flags,
    destroyCount:()=>destroyed,markCount:()=>marks,clickCount:()=>clicked};
}

test('destroy cancels pending draw and does not report stale completion',async()=>{
  const h=harness();
  const work=h.instance.draw();
  assert.equal(h.pendingDraws.length,1);
  const beforeDestroyMarks=h.markCount();
  h.instance.ngOnDestroy();
  h.pendingDraws[0].resolve();
  await work;
  assert.equal(h.instance.renderRevision,0);
  assert.equal(h.instance.destroyed,true);
  assert.equal(h.markCount(),beforeDestroyMarks);
  assert.equal(h.instance.status,'Rendering…');
  assert.equal(h.destroyCount(),1);
  assert.deepEqual(h.flags,[false]);
});

test('pending render failure after destroy must not report an error',async()=>{
  const h=harness();
  const run=h.instance.draw();
  h.instance.ngOnDestroy();
  h.pendingDraws[0].reject(new Error('private Astro mask failed'));
  await run;
  assert.equal(h.instance.error,'');
  assert.equal(h.instance.renderRevision,0);
});

test('no new render or recovery begins after destruction',async()=>{
  const h=harness();
  h.instance.ngOnDestroy();
  await h.instance.draw();
  await h.instance.drawWithPreviewRecovery();
  assert.equal(h.pendingDraws.length,0);
  assert.equal(h.instance.previewNotice,'');
  assert.equal(h.instance.renderRevision,0);
});

test('destroy during private mask failure prevents legacy fallback and notice',async()=>{
  const h=harness();
  const work=h.instance.drawWithPreviewRecovery();
  assert.equal(h.pendingDraws.length,1);
  h.instance.ngOnDestroy();
  h.pendingDraws[0].reject(new Error('Unable to load chart asset: /assets/img/virgostars-astro/masks/aries.png'));
  await work;
  assert.equal(h.pendingDraws.length,1);
  assert.equal(h.instance.previewNotice,'');
  assert.deepEqual(h.flags,[false]);
});

test('no downloaded PNG or late status change after destroy during export',async()=>{
  const h=harness();
  const exportWork=h.instance.exportPng();
  assert.equal(h.pendingExports.length,1);
  h.instance.ngOnDestroy();
  h.pendingExports[0].resolve('data:image/png;base64,AAA');
  await exportWork;
  assert.equal(h.clickCount(),0);
  assert.equal(h.instance.status,'Exporting…');
  assert.equal(h.destroyCount(),1);
});

test('destroyed demo rejects new PNG exports and error updates',async()=>{
  const h=harness();
  h.instance.ngOnDestroy();
  await h.instance.exportPng();
  h.instance.showError(new Error('late failure'));
  assert.equal(h.pendingExports.length,0);
  assert.equal(h.instance.error,'');
  assert.equal(h.clickCount(),0);
});

test('component destruction is idempotent and clears static preview once',()=>{
  const h=harness();
  h.instance.ngOnDestroy();
  const request=h.instance.drawRequest;
  h.instance.ngOnDestroy();
  assert.equal(h.instance.drawRequest,request);
  assert.equal(h.destroyCount(),1);
  assert.deepEqual(h.flags,[false]);
});
