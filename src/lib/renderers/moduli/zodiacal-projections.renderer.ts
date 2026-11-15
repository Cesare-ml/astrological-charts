import * as THREE from 'three';
import { OggettiSempliciRender } from '../oggetti-semplici.renderer';
import { ElementiCelestiRender } from './elementi-celesti.renderer';
import { Colori } from '../_colori.config';
import {
  mirroredLongitude, ZODIAC_REFLECTION_AXES, ZODIAC_TRADITIONAL_PLANETS,
  type ZodiacProjectionKind, type ZodiacReflectionAxis
} from './zodiacal-projections';

/**
 * Dedicated natal projection overlay. No ephemeris math or derived aspects.
 *
 * Visual convention adopted from the Regolo Alpha Leonis project:
 *   antisci       => 3 solid edges (natal body, antiscion, chart centre)
 *   contrantisci  => one red dashed radial line, centre to contrantiscion
 *   tutti         => filled vs hollow planet-colored markers, no individual lines
 *
 * Angular host components own the controls; this renderer only receives options.
 */
export class ZodiacalProjectionsRenderer {
  private static radialPoint(longitude: number, ascendant: number, radius: number): THREE.Vector3 {
    return new THREE.Vector3(0, radius, 0).applyAxisAngle(
      new THREE.Vector3(0, 0, 1),
      THREE.MathUtils.degToRad(90 - ascendant + longitude)
    );
  }

  public static async create(
    theme: any,
    options: any,
    ascendant: number,
    zodiacDiameter: number,
    houseDiameter: number,
    planetsInnerDiameter: number,
    planetsOuterDiameter: number,
    symbolScale: number,
    southernInversion: boolean
  ): Promise<THREE.Group> {
    const group = new THREE.Group();
    const selection = options.proiezioneZodiacale;
    const kind: ZodiacProjectionKind | undefined = selection?.tipo;
    const axis: ZodiacReflectionAxis = selection?.asse ?? 'Cardinale';
    const chosen: string | undefined = selection?.pianeta;
    if (!chosen || (kind !== 'antisci' && kind !== 'contrantisci') ||
      !Object.prototype.hasOwnProperty.call(ZODIAC_REFLECTION_AXES, axis)) return group;

    const bodies = ElementiCelestiRender.getElementiCelesti(theme, options, true, 'longitude', false);
    const axisLine = OggettiSempliciRender.getLineaGrossa(
      {x: 0, y: -zodiacDiameter / 2, z: 0},
      {x: 0, y: zodiacDiameter / 2, z: 0},
      options.settaggi.skin_id === 'light' ? 'orange' : 'yellow',
      0.6
    );
    axisLine.rotateZ(THREE.MathUtils.degToRad(90 - ascendant + ZODIAC_REFLECTION_AXES[axis]));
    group.add(axisLine);

    const radius = houseDiameter / 2;
    const rimRadius = planetsOuterDiameter / 2;
    const glyphRadius = (planetsInnerDiameter + planetsOuterDiameter) / 4;
    const markerRadius = 0.034;
    const neutral = options.settaggi.skin_id === 'light' ? '#000000' : '#ffffff';
    const origin = new THREE.Vector3(0, 0, 0);

    for (const name of ZODIAC_TRADITIONAL_PLANETS) {
      const body = bodies[name];
      const longitude = body?.longitude;
      if (typeof longitude !== 'number' || !Number.isFinite(longitude)) continue;
      if (chosen !== 'tutti' && chosen !== name) continue;

      const target = mirroredLongitude(longitude, kind, axis);
      if (target === null) continue;
      const planetColor = Colori.elementiCelesti[name] ?? '#ffffff';
      if (chosen === 'tutti') {
        // Markers touch the *inside* of the planet ring's outer edge.
        const marker = new THREE.Mesh(
          kind === 'antisci'
            ? new THREE.CircleGeometry(markerRadius, 28)
            : new THREE.RingGeometry(markerRadius * 0.62, markerRadius, 28),
          new THREE.MeshBasicMaterial({color: planetColor, side: THREE.DoubleSide})
        );
        marker.position.copy(this.radialPoint(target, ascendant, rimRadius - markerRadius));
        marker.position.z = 0.045;
        group.add(marker);
        continue;
      }

      const natalPoint = this.radialPoint(longitude, ascendant, radius);
      const targetPoint = this.radialPoint(target, ascendant, radius);
      const ringMarker = OggettiSempliciRender.getCerchio(0.025, neutral);
      ringMarker.position.copy(targetPoint);
      ringMarker.position.z = 0.045;
      group.add(ringMarker);

      if (kind === 'antisci') {
        // Three continuous lines: natal → mirrored → origin → natal.
        group.add(OggettiSempliciRender.getLineaGrossa(natalPoint, targetPoint, planetColor, 0.6));
        group.add(OggettiSempliciRender.getLineaGrossa(targetPoint, origin, planetColor, 0.6));
        group.add(OggettiSempliciRender.getLineaGrossa(origin, natalPoint, planetColor, 0.6));
      } else {
        // Contra-antiscion has its own geometry, not the antiscion triangle.
        group.add(OggettiSempliciRender.getLineaGrossaTratteggiata(
          origin, targetPoint, '#f60a09', 0.6, 0.05
        ));
      }

      // Reuse existing host-owned planet symbol; no new or copied artwork.
      const filename = 'simboli-bianchi/elementi-celesti/' + name
        + (body.longitudeSpeed < 0 ? '-r.png' : '.png');
      const glyph = await OggettiSempliciRender.getImg(
        filename, 875, 605, 1 / 875, southernInversion, planetColor
      );
      glyph.scale.set(0.23 * symbolScale, 0.23 * symbolScale, 1);
      glyph.position.copy(this.radialPoint(target, ascendant, glyphRadius));
      glyph.position.z = 0.055;
      glyph.rotation.z = 0;
      // Only the interactive canvas pulses. Static scene/PNG remains unanimated.
      glyph.userData.pulseZodiacalProjection = true;
      group.add(glyph);
    }

    return group;
  }
}
