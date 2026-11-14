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

test('latitude asset names reject URL syntax, traversal and invalid filename stems', () => {
  const invalid = [
    '', ' ', ' Sun', 'Sun ', '.', '..', '../Sun', 'Sun/../Moon',
    'Sun\\Moon', 'Sun%2fMoon', 'Sun?raw=1', 'Sun#fragment',
    'Sun:Moon', 'Sun\nMoon', 'Sun\u007fMoon', null, undefined, 12,
  ];
  for (const name of invalid) {
    for (const transit of [false, true]) {
      assert.throws(
        () => latitudePlanetAsset('light', name, transit),
        { name: 'TypeError', message: /single non-empty filename stem/ },
        `Unexpectedly accepted latitude name: ${String(name)}`,
      );
    }
  }
});

test('latitude asset names preserve legitimate spaced and dotted planet keys', () => {
  for (const name of ['Sun', 'mean Node Sud', 'osc. Apogee', 'vertex']) {
    assert.equal(latitudePlanetAsset('light', name, false),
      `symbols/planets/light/_circle/${name}.png`);
    assert.equal(latitudePlanetAsset('dark-bn', name, true),
      `simboli/elementi-celesti/dark/cerchio/anello/${name}.png`);
  }
});
