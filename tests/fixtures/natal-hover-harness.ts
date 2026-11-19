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
const transitEvents: any[] = [];
const options = structuredClone(defaultOpzioniGrafico);
for (const body of demoBodies) {
  options.settaggi.elementi_celesti[body].att = true;
  options.settaggi.elementi_celesti[body].aspVerso = true;
}
for (const axis of ['AS','DS','MC','IC']) options.settaggi.elementi_celesti[axis].att = true;
options.nascondiAssiDuplicati = true;
const fixture = makeDemoTheme(0);
for (const [name, longitude] of [['true Node',72], ['osc. Apogee',135], ['Tyche',240]] as const) {
  fixture.planets[name] = {...fixture.planets.Sun, longitude};
  options.settaggi.elementi_celesti[name].att = true;
}
for (const [index, name] of demoBodies.slice(0,7).entries()) {
  fixture.planets[name].dodecatemoria = {longitude:(35+index*37)%360, longitudeSpeed:1};
}
(globalThis as any).hoverHarness = {
  async init(base: string) {
    GestoreImmagini.configurePublicAssetsBase(base);
    service.inizializzaGraficoRender(new ElementRef(canvas), {x:600,y:600});
    service.setNatalPlanetHoverListener(value => { events.push(value); service.setNatalAspectsVisible(!value); });
    await service.disegnaScena(fixture, null, null, 'carta-astrale', options);
  },
  async redraw() { await service.disegnaScena(fixture, null, null, 'carta-astrale', options); },
  async initTransits() {
    service.setNatalPlanetHoverListener(null);
    service.setTransitPointHoverListener(value => {
      transitEvents.push(value);
      service.setTransitAspectLines(value ? [{aspect:'trigono', transitName:'Jupiter', transitLongitude:120,
        natalName:'Sun', natalLongitude:0}] : []);
    });
    const transit = makeDemoTheme(52);
    transit.planets.Jupiter.longitude = 120;
    options.mostraTransiti = true;
    options.mostraAssiTransiti = true;
    await service.disegnaScena(fixture, transit, null, 'carta-astrale', options);
    service.setNatalAspectsDimmed(true);
  },
  async initSynastry() {
    options.mostraTransiti = false;
    options.mostraSinastria = true;
    options.mostraAssiSinastria = true;
    service.setTransitPointHoverListener(value => {
      transitEvents.push(value);
      service.setTransitAspectLines(value ? [{aspect:'trigono', transitName:'Jupiter', transitLongitude:120,
        natalName:'Sun', natalLongitude:0}] : []);
    });
    const partner = makeDemoTheme(52);
    partner.planets.Jupiter.longitude = 120;
    await service.disegnaScena(fixture, null, partner, 'carta-astrale', options);
    service.setNatalAspectsDimmed(true);
  },
  synastryAxes() {
    const scene = (service as any).scene as THREE.Scene;
    const dots:string[] = [], glyphs:string[] = [];
    scene.traverse(group => {
      if (group.userData.chartInteractionRole === 'synastry-axes') group.children.forEach(object => {
        if (object.userData.axisStem && (object as THREE.Mesh).geometry?.type === 'CircleGeometry') dots.push(object.userData.axisStem);
      });
      if (group.userData.chartInteractionRole === 'synastry-planets') group.traverse(object => {
        if (['AS','DS','MC','IC'].includes(object.userData.planet)) glyphs.push(object.userData.planet);
      });
    });
    return {dots, glyphs};
  },
  transitAxisPoint(name: string) {
    const scene = (service as any).scene as THREE.Scene;
    let marker: THREE.Object3D | undefined;
    scene.traverse(group => {
      if (group.userData.chartInteractionRole === 'transit-axes') group.traverse(object => {
        if (object.userData.axisMarker === name) marker = object;
      });
    });
    if (!marker) throw Error(`Missing transit axis ${name}`);
    scene.updateMatrixWorld(true);
    const line = marker as THREE.LineSegments;
    const position = marker instanceof THREE.LineSegments
      ? new THREE.Vector3().fromBufferAttribute(line.geometry.attributes.position, 1) : new THREE.Vector3();
    const p = marker.localToWorld(position).project(service.camera);
    const r = canvas.getBoundingClientRect();
    return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
  },
  async transitAxesCount(enabled: boolean, hasHouses: boolean) {
    const transit = makeDemoTheme(52);
    if (!hasHouses) transit.houses = {};
    options.mostraAssiTransiti = enabled;
    await service.disegnaScena(fixture, transit, null, 'carta-astrale', options);
    let count = 0;
    ((service as any).scene as THREE.Scene).traverse(group => {
      if (group.userData.chartInteractionRole === 'transit-axes') count += group.children.filter(child => child.userData.axisStem).length;
    });
    return count;
  },
  async projectionState(mode:string, selected:string) {
    options.mostraTransiti = false;
    options.mostraSinastria = false;
    options.dodecatemoriAttivi = mode === 'dodecatemoria';
    options.dodecatemore = mode === 'dodecatemoria' ? selected : undefined;
    options.proiezioneZodiacale = mode === 'antisci' || mode === 'contrantisci' ? {
      tipo:mode, asse:'Cardinale', pianeta:selected,
      punti:[{name:'Sun',longitude:358.4,antiscia:181.6,contraAntiscia:1.6,retrograde:false},
        {name:'Moon',longitude:2.1,antiscia:177.9,contraAntiscia:357.9,retrograde:false}],
    } : undefined;
    await service.disegnaScena(fixture,null,null,'carta-astrale',options);
    const items:any[] = [];
    ((service as any).scene as THREE.Scene).traverse(object => {
      if (object.userData.dodecatemoria) items.push({name:object.userData.dodecatemoria,longitude:object.userData.trueLongitude,kind:'dodeca',geometry:(object as THREE.Mesh).geometry.type,color:(object as THREE.Mesh).material['color']?.getHexString()});
      if (object.userData.projectionPoint) items.push({name:object.userData.projectionPoint,longitude:object.userData.trueLongitude,kind:object.geometry?.type});
    });
    return items;
  },
  async subdivisions() {
    options.mostraTransiti = false;
    options.dodecatemoriAttivi = false;
    options.proiezioneZodiacale = undefined;
    options.mostraDecani = true;
    options.mostraDecadi = true;
    options.mostraTermini = true;
    options.settaggi.domificazione_selezionata = 'egizia';
    await service.disegnaScena(fixture,null,null,'carta-astrale',options);
    const decades:any[] = [], terms:number[] = [];
    ((service as any).scene as THREE.Scene).traverse(object => {
      if (object.userData.decadeIndex !== undefined) decades.push([object.userData.decadeIndex,object.userData.decadeSign]);
      if (object.userData.regoloTermine !== undefined) terms.push(object.userData.regoloTermine);
    });
    return {decades,terms};
  },
  transitPoint(name: string, ring: string) {
    const scene = (service as any).scene as THREE.Scene;
    let glyph: THREE.Object3D | undefined;
    scene.traverse(group => {
      if (group.userData.chartInteractionRole === `${ring}-planets`) group.traverse(object => {
        if (object.userData.planet === name) glyph = object;
      });
    });
    if (!glyph) throw Error(`Missing ${ring} ${name}`);
    scene.updateMatrixWorld(true);
    const p = glyph.getWorldPosition(new THREE.Vector3()).project(service.camera);
    const r = canvas.getBoundingClientRect();
    return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
  },
  transitState() {
    const scene = (service as any).scene as THREE.Scene;
    let opacity: number | undefined, vertexColors: boolean | undefined;
    scene.traverse(group => {
      if (group.userData.chartInteractionRole === 'natal-aspect-lines') group.traverse(object => {
        const material = (object as THREE.Mesh).material as THREE.Material;
        if (material && opacity === undefined) { opacity = material.opacity; vertexColors = material.vertexColors; }
      });
    });
    return {last:transitEvents.at(-1) ?? null, opacity, vertexColors, lines:(service as any).transitLines?.children.length ?? 0};
  },
  restoreTransit() { service.setTransitPointHoverListener(null); service.setTransitAspectLines([]); service.setNatalAspectsDimmed(false); },
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
  axisPoint(name: string) {
    const scene = (service as any).scene as THREE.Scene;
    let label: THREE.Object3D | undefined;
    scene.traverse(object => { if (object.userData.axisName === name) label = object; });
    if (!label) throw Error('Missing axis label');
    scene.updateMatrixWorld(true);
    const p = label.getWorldPosition(new THREE.Vector3()).project(service.camera);
    const r = canvas.getBoundingClientRect();
    return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
  },
  axisMarkerPoint(name: string) {
    const scene = (service as any).scene as THREE.Scene;
    let marker: THREE.Object3D | undefined;
    scene.traverse(object => { if (object.userData.axisMarker === name) marker = object; });
    if (!marker) throw Error('Missing axis marker');
    scene.updateMatrixWorld(true);
    const geometry = (marker as THREE.LineSegments).geometry;
    const local = marker instanceof THREE.LineSegments
      ? new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, 1) : new THREE.Vector3();
    const p = marker.localToWorld(local).project(service.camera);
    const r = canvas.getBoundingClientRect();
    return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
  },
  axisGlyphs() {
    const scene = (service as any).scene as THREE.Scene;
    let group: THREE.Object3D | undefined;
    scene.traverse(object => { if (object.userData.chartInteractionRole === 'natal-planets') group = object; });
    const axes: string[] = [];
    group?.traverse(object => { if (['AS','DS','MC','IC'].includes(object.userData.planet)) axes.push(object.userData.planet); });
    return axes;
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
