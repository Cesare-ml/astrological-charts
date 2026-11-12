import * as THREE from 'three';
import { PlanetInteractionController } from '../../src/lib/renderers/planet-interaction.controller';
import { chartAspectCirclePoint, chartTransitConnectorRadii } from '../../src/lib/renderers/planet-interaction.geometry';

declare global {
  interface Window {
    runTransitSpokeGeometryProbe?: () => Record<string, boolean>;
  }
}

/** Synthetic, real Three.js geometries only. Deliberately move the glyph
 * away from its true longitude ray to mimic collision avoidance.
 * Check normal and southern-hemisphere-mirrored charts.
 */
window.runTransitSpokeGeometryProbe = () => {
  const results: Record<string, boolean> = {};
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-5;

  for (const inverted of [false, true]) {
    const suffix = inverted ? 'Mirrored' : 'Normal';
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 320;
    document.body.appendChild(canvas);
    const camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 10);
    camera.position.z = 4;
    camera.updateProjectionMatrix();
    const scene = new THREE.Scene();
    const wheel = new THREE.Group();
    wheel.position.set(0.12, -0.08, 0);
    wheel.rotation.z = 0.31;
    if (inverted) wheel.rotation.y = Math.PI;
    wheel.userData['chartAspectRadius'] = 0.45;
    scene.add(wheel);

    const body = (layer: 'natal' | 'transit', name: string) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.09, 0.09),
        new THREE.MeshBasicMaterial({color: '#171717',side:THREE.DoubleSide})
      );
      mesh.userData['chartPlanet'] = {layer,name};
      const bodyGroup = new THREE.Group();
      bodyGroup.name = 'chart-planet-body';
      bodyGroup.userData['chartPlanetBody'] = {layer,name};
      wheel.add(bodyGroup);
      mesh.userData['chartBodyVisualRole'] = 'glyph';
      bodyGroup.add(mesh);
      return mesh;
    };
    const sun = body('natal', 'Sun');
    sun.position.x = -0.25;
    sun.userData['chartAspectAngle'] = 0;
    const moon = body('natal', 'Moon');
    moon.position.x = 0.1;
    moon.userData['chartAspectAngle'] = Math.PI / 3;
    const transit = body('transit', 'Saturn');
    // This center is *not* at Saturn's actual aspect longitude,
    // as happens when the renderer separates close planet glyphs.
    transit.position.set(0.83, 0.19, 0);
    transit.userData['chartAspectAngle'] = Math.PI / 2;
    transit.userData['chartTransitRingRadius'] = 1.15;
    const neptune = body('transit', 'Neptune');
    neptune.position.set(-0.76, 0.22, 0);
    neptune.userData['chartAspectAngle'] = Math.PI * 1.5;
    neptune.userData['chartTransitRingRadius'] = 1.15;
    // An identity body wrapper must preserve all world coordinates even
    // under the wheel's rotation and southern-hemisphere mirror.
    scene.updateMatrixWorld(true);
    results['bodyGroupWorldParity' + suffix] = [sun,moon,transit,neptune].every(mesh => {
      const owner = mesh.parent;
      const ref = mesh.userData['chartPlanet'] as {layer:string;name:string};
      const descriptor = owner?.userData['chartPlanetBody'] as
        {layer:string;name:string} | undefined;
      if (!owner || owner.parent !== wheel || !descriptor ||
          descriptor.layer !== ref.layer || descriptor.name !== ref.name ||
          mesh.userData['chartBodyVisualRole'] !== 'glyph') return false;
      const expected = wheel.localToWorld(mesh.position.clone());
      const actual = mesh.getWorldPosition(new THREE.Vector3());
      return near(actual.x,expected.x) && near(actual.y,expected.y)
        && near(actual.z,expected.z)
        && owner.position.lengthSq() === 0
        && owner.rotation.lengthSq() === 0
        && owner.scale.x === 1 && owner.scale.y === 1 && owner.scale.z === 1;
    });
    const controller = new PlanetInteractionController(canvas,camera,()=>{},()=>{});
    controller.setRelations([{
      from:{layer:'natal',name:'Sun'},to:{layer:'transit',name:'Saturn'},
      type:'quadrato',orb:1
    }]);
    scene.updateMatrixWorld(true);
    controller.setScene(scene);
    controller.highlight({layer:'natal',name:'Sun'});

    const line = scene.getObjectByName('chart-interaction-transit-connector') as THREE.Line | undefined;
    const coords = line?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const start = coords && new THREE.Vector3().fromBufferAttribute(coords, 0);
    const end = coords && new THREE.Vector3().fromBufferAttribute(coords, 1);
    const span = chartTransitConnectorRadii(0.45, 1.15);
    const longitude = chartAspectCirclePoint(Math.PI / 2, 0.45);
    const endLongitude = span && chartAspectCirclePoint(Math.PI / 2, span.endRadius);
    const expectedStart = longitude && wheel.localToWorld(
      new THREE.Vector3(longitude.x, longitude.y, 0)
    );
    const expectedEnd = endLongitude && wheel.localToWorld(
      new THREE.Vector3(endLongitude.x, endLongitude.y, 0)
    );

    results['ringDirection' + suffix] = !!line && !!start && !!end &&
      !!expectedStart && !!expectedEnd &&
      near(start.x, expectedStart.x) && near(start.y, expectedStart.y) &&
      near(end.x, expectedEnd.x) && near(end.y, expectedEnd.y);
    results['ringClearance' + suffix] = !!span && !!end && !!start &&
      span.endRadius > 0.45 && span.endRadius < 1.15 &&
      near(start.z, end.z) && end.z > 0.05;
    const distances = line?.geometry.getAttribute('lineDistance');
    results['actualDashes' + suffix] = !!line &&
      line.material instanceof THREE.LineDashedMaterial &&
      !!distances && distances.getX(1) > 0 &&
      line.renderOrder === 1001;

    // One outer Saturn participates in two synthetic, differently
    // colored cross-chart aspects. All central lines remain; the single
    // dashed spoke takes the color of the *closest* orb, regardless of
    // which relation arrived first from the frontend.
    const loose = {from:{layer:'natal' as const,name:'Sun'},
      to:{layer:'transit' as const,name:'Saturn'},type:'opposizione',orb:4};
    const tight = {from:{layer:'natal' as const,name:'Moon'},
      to:{layer:'transit' as const,name:'Saturn'},type:'trigono',orb:0.5};
    controller.highlight({layer:'transit',name:'Saturn'});
    const spoke = () => scene.children.filter(child =>
      child.name === 'chart-interaction-transit-connector') as THREE.Line[];
    const central = () => scene.children.filter(child =>
      child.name === 'chart-interaction-aspect') as THREE.Line[];
    controller.setRelations([loose,tight]);
    const colorsFirst = spoke().map(line =>
      (line.material as THREE.LineDashedMaterial).color.getHexString());
    const centralColorsFirst = central().map(line =>
      (line.material as THREE.LineBasicMaterial).color.getHexString()).sort();
    controller.setRelations([tight,loose]);
    const colorsReversed = spoke().map(line =>
      (line.material as THREE.LineDashedMaterial).color.getHexString());
    const centralColorsReversed = central().map(line =>
      (line.material as THREE.LineBasicMaterial).color.getHexString()).sort();
    results['multiAspectOrderStable' + suffix] =
      colorsFirst.length === 1 && colorsFirst[0] === '0055ff' &&
      colorsReversed.length === 1 && colorsReversed[0] === '0055ff' &&
      centralColorsFirst.join(',') === '0055ff,ff0000' &&
      centralColorsReversed.join(',') === '0055ff,ff0000';
    results['multiAspectBodiesNoZoom' + suffix] =
      [sun,moon,transit].every(mesh => mesh.scale.x === 1 && mesh.scale.y === 1);

    // One selected natal body with TWO simultaneously involved outer
    // transit planets must produce two distinct radial guides, not
    // accidentally merge them because their orbit radius is shared.
    controller.highlight({layer:'natal',name:'Sun'});
    controller.setRelations([
      {from:{layer:'natal',name:'Sun'},to:{layer:'transit',name:'Saturn'},
        type:'congiunzione',orb:2},
      {from:{layer:'natal',name:'Sun'},to:{layer:'transit',name:'Neptune'},
        type:'quadrato',orb:1}
    ]);
    const twoSpokes = spoke();
    const twoColors = twoSpokes.map(line =>
      (line.material as THREE.LineDashedMaterial).color.getHexString()).sort();
    const twoStartXs = twoSpokes.map(line =>
      (line.geometry.getAttribute('position') as THREE.BufferAttribute).getX(0));
    results['twoTransitsStayDistinct' + suffix] =
      twoSpokes.length === 2 && central().length === 2 &&
      twoColors.join(',') === '33cc66,ff7800' &&
      Math.abs(twoStartXs[0] - twoStartXs[1]) > 0.5 &&
      [sun,moon,transit,neptune].every(mesh =>
        mesh.scale.x === 1 && mesh.scale.y === 1);

    // Return to the basic Saturn/Sun relationship for the old-host
    // metadata-free fallback and lifecycle checks below.
    controller.setRelations([{
      from:{layer:'natal',name:'Sun'},to:{layer:'transit',name:'Saturn'},
      type:'quadrato',orb:1
    }]);
    controller.highlight({layer:'natal',name:'Sun'});
    // Old/synthetic consumers without new metadata still draw their
    // previous fallback connector using the displayed glyph radius.
    controller.highlight(null);
    delete transit.userData['chartTransitRingRadius'];
    controller.highlight({layer:'natal',name:'Sun'});
    const fallback = scene.getObjectByName('chart-interaction-transit-connector') as THREE.Line | undefined;
    const position = fallback?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const fallbackEnd = position && new THREE.Vector3().fromBufferAttribute(position, 1);
    const actualRadius = transit.getWorldPosition(new THREE.Vector3()).distanceTo(
      wheel.getWorldPosition(new THREE.Vector3())
    );
    const fallbackSpan = chartTransitConnectorRadii(0.45, actualRadius);
    const fallbackLocal = fallbackSpan &&
      chartAspectCirclePoint(Math.PI / 2, fallbackSpan.endRadius);
    const fallbackExpected = fallbackLocal && wheel.localToWorld(
      new THREE.Vector3(fallbackLocal.x, fallbackLocal.y, 0)
    );
    results['backwardCompatible' + suffix] = !!fallback && !!fallbackEnd &&
      !!fallbackExpected && near(fallbackEnd.x, fallbackExpected.x) &&
      near(fallbackEnd.y, fallbackExpected.y);

    let disposed = 0;
    fallback?.geometry.addEventListener('dispose',()=>disposed++);
    (fallback?.material as THREE.Material | undefined)?.addEventListener('dispose',()=>disposed++);
    controller.setRelations([]);
    results['cleanup' + suffix] =
      !scene.getObjectByName('chart-interaction-transit-connector') && disposed === 2;
    controller.destroy();
    for (const mesh of [sun,moon,transit,neptune]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    canvas.remove();
  }
  return results;
};
