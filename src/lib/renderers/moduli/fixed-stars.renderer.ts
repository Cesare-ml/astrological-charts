import * as THREE from 'three';
import gsap from 'gsap';
import {registerSceneAnimation} from '../scene-animations';
import {layoutPlanetSymbols} from './planet-symbol-layout';

export interface FixedStarMarker {id:number; longitude:number; magnitude:number; axisContact:boolean;}

/** Renders caller-calculated positions; no astronomy or contacts are calculated here. */
export function createFixedStarRing(stars:readonly FixedStarMarker[], asc:number, radius:number): THREE.Group {
  const group = new THREE.Group();
  group.userData.chartInteractionRole = 'fixed-stars';
  const longitudes:Record<string,number> = {};
  for (const star of stars) if (Number.isSafeInteger(star.id) && Number.isFinite(star.longitude)) longitudes[String(star.id)] = star.longitude;
  const layout = layoutPlanetSymbols(longitudes, Math.max(.1, radius-.12), radius+.04,
    .11, .11, false, 90-asc, {maxAngularDisplacement:8});
  for (const star of stars) {
    if (!Number.isFinite(star.longitude) || !Number.isFinite(star.magnitude) || !Number.isSafeInteger(star.id)) continue;
    const size = Math.min(.065, Math.max(.022, .052 - star.magnitude * .006));
    // A neutral data point, not an invented celestial glyph. The asset pack
    // has no approved fixed-star symbol; the name is exposed by hover.
    const material = new THREE.MeshBasicMaterial({color:0xe5b744, transparent:true, side:THREE.DoubleSide});
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(size,24), material);
    const position = layout[String(star.id)];
    if (!position) { mesh.geometry.dispose(); material.dispose(); continue; }
    const angle = (90 - asc + position.displayDegree) * Math.PI/180;
    mesh.position.set(-Math.sin(angle)*position.radius, Math.cos(angle)*position.radius, .03);
    mesh.userData.fixedStarId = star.id;
    group.add(mesh);
    if (star.axisContact) {
      const animation = gsap.timeline({repeat:-1, yoyo:true}).to(material, {opacity:.2, duration:1});
      registerSceneAnimation(group, animation);
    }
  }
  return group;
}
