import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/renderers/planet-layout.ts',import.meta.url),'utf8');
const js = ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const layout = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

/** Reference from the pre-extraction ElementiCelestiRender implementation. */
function originalLayout(bodies,coordinate,minDistance=7) {
  let points = [];
  for (const name in bodies) points.push({key:name,deg:bodies[name][coordinate]%360});
  points = JSON.parse(JSON.stringify(points));
  const cycle = () => {
    points.sort((a,b)=>a.deg-b.deg);
    for (let i=1;i<points.length;i++) {
      const a=points[i-1].deg;
      let b=points[i].deg;
      if (b-a<minDistance) b+=minDistance-(b-a);
      points[i].deg=b;
    }
    for (const item of points) item.deg=(item.deg+180)%360;
  };
  cycle();cycle();
  const result={};
  for(const item of points) result[item.key]={[coordinate]:item.deg};
  return result;
}

test('two-pass circular glyph collision layout keeps original ordering and angles',()=>{
  const cases=[
    {},
    {Sun:{longitude:23}},
    {Sun:{longitude:359.5},Moon:{longitude:0.5},Mercury:{longitude:2}},
    {AS:{longitude:0},DS:{longitude:180},MC:{longitude:90},IC:{longitude:270}},
    {Sun:{longitude:25},Moon:{longitude:25},Mercury:{longitude:25},Venus:{longitude:25}},
    {Sun:{longitude:-12},Moon:{longitude:372},Mars:{longitude:183}},
    {Sun:{longitude:NaN},Moon:{longitude:Infinity},Mars:{longitude:-Infinity}}
  ];
  for(const bodies of cases) {
    const original=structuredClone(bodies);
    assert.deepEqual(layout.layoutChartGlyphLongitudes(bodies,'longitude'),
      originalLayout(bodies,'longitude'));
    assert.deepEqual(bodies,original,'render-only collision layout must not mutate caller longitudes');
  }
});

test('200 deterministic synthetic charts retain old glyph layout',()=>{
  let seed=0x9e3779b9;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const names=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','AS','MC'];
  for(let iteration=0;iteration<200;iteration++){
    const bodies={};
    for(const name of names) {
      const longitude=iteration%4===0 ? Math.round(random()*6)*60
        : Math.round(random()*36000)/100;
      bodies[name]={longitude,latitude:random()*10-5};
    }
    const baseline=originalLayout(bodies,'longitude');
    assert.deepEqual(layout.layoutChartGlyphLongitudes(bodies,'longitude'),baseline);
  }
});

test('latitude layout and configurable collision distance preserve legacy results',()=>{
  const bodies={Sun:{latitude:-1,longitude:20},Moon:{latitude:1,longitude:21},Mars:{latitude:1.5,longitude:22}};
  const untouched=structuredClone(bodies);
  assert.deepEqual(layout.layoutChartGlyphLongitudes(bodies,'latitude',7),
    originalLayout(bodies,'latitude',7));
  assert.deepEqual(layout.layoutChartGlyphLongitudes(bodies,'longitude',12),
    originalLayout(bodies,'longitude',12));
  assert.deepEqual(bodies,untouched);
});

test('one legacy cycle mutates its own working array and does not duplicate glyphs',()=>{
  const points=[{key:'Sun',deg:1},{key:'Moon',deg:3},{key:'Mars',deg:3}];
  const reference=points.map(v=>({...v}));
  reference.sort((a,b)=>a.deg-b.deg);
  for(let i=1;i<reference.length;i++) {
    const a=reference[i-1].deg;let b=reference[i].deg;
    if(b-a<7)b+=7-(b-a);reference[i].deg=b;
  }
  for(const item of reference)item.deg=(item.deg+180)%360;
  const result=layout.relaxChartGlyphCycle(points);
  assert.equal(result,points);
  assert.deepEqual(result,reference);
  assert.equal(new Set(result.map(x=>x.key)).size,3);
});
