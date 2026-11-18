import '@angular/compiler';
import {ElementRef} from '@angular/core';
import * as THREE from 'three';
import {defaultOpzioniGrafico, GestoreImmagini, GraficoRenderService} from '../../src/public-api';
import {demoBodies, makeDemoTheme} from '../../demo/fixtures';

const canvas = document.createElement('canvas');
canvas.width = canvas.height = 600;
canvas.style.width = canvas.style.height = '600px';
document.body.append(canvas);
const service = new GraficoRenderService();
const events: unknown[] = [];
const options = structuredClone(defaultOpzioniGrafico);
for (const body of demoBodies) options.settaggi.elementi_celesti[body].att = true;
const fixture = makeDemoTheme(0);
(globalThis as any).hoverHarness = {
  async init(base: string) {
    GestoreImmagini.configurePublicAssetsBase(base);
    service.inizializzaGraficoRender(new ElementRef(canvas), {x:600,y:600});
    service.setNatalPlanetHoverListener(value => { events.push(value); service.setNatalAspectsVisible(!value); });
    await service.disegnaScena(fixture, null, null, 'carta-astrale', options);
  },
  async redraw() { await service.disegnaScena(fixture, null, null, 'carta-astrale', options); },
  point(name: string) {
    const scene = (service as any).scene as THREE.Scene;
    let glyph: THREE.Object3D | undefined;
    scene.traverse(object => { if (object.userData.planet === name) glyph = object; });
    if (!glyph) throw Error('Missing synthetic glyph');
    scene.updateMatrixWorld(true);
    const p = glyph.getWorldPosition(new THREE.Vector3()).project(service.camera);
    const r = canvas.getBoundingClientRect();
    return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
  },
  state() {
    const scene = (service as any).scene as THREE.Scene;
    let lines: THREE.Object3D | undefined;
    scene.traverse(object => { if (object.userData.chartInteractionRole === 'natal-aspect-lines') lines = object; });
    return {last:events.at(-1) ?? null, linesVisible:lines?.visible ?? null,
      backgroundVisible:lines?.parent?.children.some(child => child !== lines && child.visible) ?? false};
  },
  destroy() { service.ngOnDestroy(); },
};
