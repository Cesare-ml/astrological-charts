import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/renderers/@carta-astrale/latitude-asset-paths.ts',import.meta.url),'utf8');
const output = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {latitudePlanetAsset} = await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));

test('latitude circles and transit rings use existing compatible artwork families', () => {
  const expected = {dark:'dark', 'dark-bn':'dark', light:'light', 'light-bn':'light', sun:'light', astrolabio:'astrolabio', 'astrolabio-girasole':'astrolabio'};
  for (const [skin,base] of Object.entries(expected)) {
    const circle = base === 'dark' ? 'dark' : 'light';
    assert.equal(latitudePlanetAsset(skin,'Sun',false),`symbols/planets/${circle}/_circle/Sun.png`);
    assert.equal(latitudePlanetAsset(skin,'Sun',true),`simboli/elementi-celesti/${base}/cerchio/anello/Sun.png`);
    assert.match(latitudePlanetAsset(skin,'true Node',false),/_circle\/true node\.png$/);
    assert.match(latitudePlanetAsset(skin,'true Node',true),/anello\/true node\.png$/);
  }
});
