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

test('legitimate planet names including internal spaces and dots retain their exact asset paths', () => {
  const names = ['Sun', 'mean Apogee', 'osc. Apogee', 'true Node', 'mean Node Sud'];
  for (const name of names) {
    const filename = name === 'true Node' ? 'true node' : name;
    assert.equal(latitudePlanetAsset('light',name,false), `symbols/planets/light/_circle/${filename}.png`);
    assert.equal(latitudePlanetAsset('astrolabio',name,true), `simboli/elementi-celesti/astrolabio/cerchio/anello/${filename}.png`);
  }
});

test('untrusted planet identifiers cannot navigate or change an asset URL', () => {
  const invalid = [undefined, null, 123, '', ' ', '.', '..', ' Sun', 'Sun ', '../private', './Sun',
    'Sun/alt', 'Sun\\alt', 'Sun%2fextra', 'Sun?size=1', 'Sun#fragment', 'Sun:alt', 'Sun\nMars', 'Sun\u0000Mars'];
  for (const name of invalid) {
    for (const transit of [false,true]) {
      assert.throws(() => latitudePlanetAsset('light',name,transit), {name:'TypeError'}, `Rejected ${JSON.stringify(name)}`);
    }
  }
});
