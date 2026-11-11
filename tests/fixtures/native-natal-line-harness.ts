import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';

declare global {
  interface Window {
    runNativeNatalAspectLineProbe?: () => Record<string, boolean | number>;
  }
}

/** Real Three.js Line2 / LineGeometry / LineMaterial variants matching
 * OggettiSempliciRender.createFatLine(). Invented positions, no private art.
 * Solid, dashed and dotted styles differ only in number of native segments;
 * the renderer's existing algorithm owns the segment locations.
 */
window.runNativeNatalAspectLineProbe = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 320;
  document.body.appendChild(canvas);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5);
  camera.position.z = 3;
  const scene = new THREE.Scene();
  const wheel = new THREE.Group();
  wheel.rotation.z = 0.17;
  wheel.userData['chartAspectRadius'] = 0.5;
  scene.add(wheel);
  const originalColor = new THREE.Color('#E25B3C');
  const gray = new THREE.Color('#898989');
  function stroke(x: number, y: number, width: number): Line2 {
    const geometry = new LineGeometry();
    geometry.setPositions([x, y, 0, x + 0.09, y + 0.06, 0]);
    const c = originalColor;
    geometry.setColors([c.r, c.g, c.b, c.r, c.g, c.b]);
    const material = new LineMaterial({linewidth: width, vertexColors: true});
    material.resolution.set(320, 320);
    return new Line2(geometry, material);
  }
  const groups: {name:string; group:THREE.Group; segments:Line2[]}[] = [];
  function nativeAspect(name: string, from: string, to: string, parts: number): void {
    const group = new THREE.Group();
    group.name = 'native-' + name;
    group.position.x = parts * 0.017;
    group.userData['chartNatalAspect'] = {from,to,type:'quadrato'};
    const segments: Line2[] = [];
    for (let index = 0; index < parts; index++) {
      const line = stroke(index * 0.13 - 0.27, parts * 0.065, 1.3 + parts / 10);
      segments.push(line);
      group.add(line);
    }
    wheel.add(group);
    groups.push({name,group,segments});
  }
  nativeAspect('solid', 'Sun', 'Moon', 1);
  nativeAspect('dashes', 'Sun', 'MC', 3);
  nativeAspect('dots', 'Venus', 'Mars', 4);
  const originals = groups.flatMap(({segments}) => segments);
  let sourceDisposals = 0;
  for (const line of originals) {
    line.geometry.addEventListener('dispose', () => sourceDisposals++);
    line.material.addEventListener('dispose', () => sourceDisposals++);
  }
  const controller = new PlanetInteractionController(canvas, camera, () => {}, () => {});
  controller.setScene(scene);
  controller.setNatalAspectPresentation('focused');
  controller.highlight({layer:'natal',name:'Sun'});

  const focusedGroups = wheel.children.filter(obj => obj.name === 'chart-interaction-natal-focus');
  const foregroundSegments = focusedGroups.flatMap(g => g.children as Line2[]);
  const foregroundCopyCount = focusedGroups.length === 2 &&
    foregroundSegments.length === 4 &&
    originals.length === 8;
  const close = (a: number, b: number) => Math.abs(a-b) < 1e-5;
  const colorOf = (line: Line2) => {
    const attr = line.geometry.getAttribute('instanceColorStart');
    return [attr.getX(0), attr.getY(0), attr.getZ(0)];
  };
  const hasColor = (line:Line2, c:THREE.Color) => {
    const rgb = colorOf(line);
    return close(rgb[0],c.r) && close(rgb[1],c.g) && close(rgb[2],c.b);
  };
  const allNativeMuted = originals.every(line => hasColor(line,gray));
  const onlyRelevantForegroundColored = foregroundSegments.every(line =>
    hasColor(line,originalColor));
  const linesAreUnshared = foregroundSegments.every((line,i) => {
    const origin = i === 0 ? groups[0].segments[0] : groups[1].segments[i-1];
    return line.geometry !== origin.geometry && line.material !== origin.material
      && close(line.material.linewidth, origin.material.linewidth)
      && line.renderOrder === 999
      && Object.keys(line.userData).length === 0;
  });
  const exactTransform = focusedGroups.every((g,i) => {
    const origin = groups[i].group;
    return close(g.position.x, origin.position.x) &&
      close(g.position.y,origin.position.y) &&
      close(g.rotation.z,origin.rotation.z);
  });

  let cloneDisposals = 0;
  for (const line of foregroundSegments) {
    line.geometry.addEventListener('dispose', () => cloneDisposals++);
    line.material.addEventListener('dispose', () => cloneDisposals++);
  }
  controller.highlight({layer:'natal',name:'Venus'});
  const previousForegroundDisposed = cloneDisposals === 8;
  const switchRemovedSunOverlays =
    wheel.children.filter(obj => obj.name === 'chart-interaction-natal-focus').length === 1;
  const unrelatedSunLinksStayMuted =
    groups[0].segments.every(line=>hasColor(line,gray)) &&
    groups[1].segments.every(line=>hasColor(line,gray));

  controller.setNatalAspectPresentation('all');
  const allColorsRestored = originals.every(line => hasColor(line,originalColor));
  const noOrphanForegrounds = !wheel.children.some(obj =>
    obj.name === 'chart-interaction-natal-focus');
  const originalsNeverDisposed = sourceDisposals === 0;
  controller.destroy();

  for (const line of originals) {
    line.geometry.dispose();
    line.material.dispose();
  }
  canvas.remove();
  return {
    foregroundCopyCount, allNativeMuted, onlyRelevantForegroundColored,
    linesAreUnshared, exactTransform, previousForegroundDisposed,
    switchRemovedSunOverlays, unrelatedSunLinksStayMuted, allColorsRestored,
    noOrphanForegrounds, originalsNeverDisposed
  };
};
