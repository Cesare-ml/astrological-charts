import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';

const bundle = await build({
  entryPoints:[new URL('../src/lib/monomeric-cross/monomeric-cross.adapter.ts',import.meta.url).pathname],
  bundle:true,format:'esm',platform:'node',write:false,
});
const {monomericCrossViewFromGeometry} = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);
const names=[
  ['master',0,'MARS','PRIMARY'],['square-left',3,'MOON','PRIMARY'],
  ['square-right',9,'SATURN','PRIMARY'],['opposite',6,'VENUS','SECONDARY'],
];
const geometry = {hourRuler:'MERCURY',houseSystemId:'VEHLOW',arms:names.map(([role,signIndex,signRuler,signRulerDomicile])=>({
  role,signIndex,longitudeDeg:signIndex*30+4,house:8,signRuler,signRulerDomicile,
  rulerLongitudeDeg:120,rulerHouse:5,
}))};

test('cross adapter preserves primary and secondary domicile ranks for the sign governor',()=>{
  const result=monomericCrossViewFromGeometry(geometry,'it');
  assert.deepEqual(result.arms.map(a=>a.signRuler),['Marte','Luna','Saturno','Venere']);
  assert.deepEqual(result.arms.map(a=>a.signRulerDomicile),['PRIMARY','PRIMARY','PRIMARY','SECONDARY']);
  const component=readFileSync(new URL('../src/lib/monomeric-cross/monomeric-cross.component.html',import.meta.url),'utf8');
  assert.match(component,/Governatore del segno/);
  assert.match(component,/domicilio primario/);
  assert.match(component,/domicilio secondario/);
});

test('older geometry remains compatible and does not invent a domicile grade',()=>{
  const old={...geometry,arms:geometry.arms.map(({signRulerDomicile,...rest})=>rest)};
  assert.deepEqual(monomericCrossViewFromGeometry(old,'en').arms.map(a=>a.signRulerDomicile),[null,null,null,null]);
});
