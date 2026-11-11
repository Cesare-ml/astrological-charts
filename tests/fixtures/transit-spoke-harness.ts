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
      wheel.add(mesh);
      return mesh;
    };
    const sun = body('natal', 'Sun');
    sun.position.x = -0.25;
    sun.userData['chartAspectAngle'] = 0;
    const transit = body('transit', 'Saturn');
    // This center is *not* at Saturn's actual aspect longitude,
    // as happens when the renderer separates close planet glyphs.
    transit.position.set(0.83, 0.19, 0);
    transit.userData['chartAspectAngle'] = Math.PI / 2;
    transit.userData['chartTransitRingRadius'] = 1.15;
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
    for (const mesh of [sun,transit]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    canvas.remove();
  }
  return results;
};
