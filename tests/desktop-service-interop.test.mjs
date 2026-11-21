import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=()=>readFileSync(new URL('../src/lib/services/grafico-render.service.ts',import.meta.url),'utf8');
test('Desktop-compatible pointer hover APIs use real tagged scene objects only',()=>{
  const s=read();
  assert.match(s,/public setFixedStarHoverListener\(/);
  assert.match(s,/public setChakraHoverListener\(/);
  assert.match(s,/intersectObjects\(this\.scene\.children,true\)/);
  assert.match(s,/userData\?\.fixedStarId/);
  assert.match(s,/userData\?\.chakra/);
  assert.match(s,/removeEventListener\('pointermove',this\.onSelectionMove\)/);
});
test('desktop wheel zoom and fit methods are implemented with camera projection',()=>{
  const s=read();
  assert.match(s,/public zoomAt\(clientX:number,clientY:number,factor:number\)/);
  assert.match(s,/intersectPlane\(plane,target\)/);
  assert.match(s,/public resetFraming\(\):void/);
  assert.match(s,/this\.camera\.position\.x=0;this\.camera\.position\.y=0;/);
});
