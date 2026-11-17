import * as THREE from 'three';
import { OggettiSempliciRender } from '../oggetti-semplici.renderer';

const AXIS_PALETTE = {
  asc: '#cb5c12',
  ds: '#148663',
  mc: '#6831bf',
  ic: '#9976ce',
};

const HOUR_PLANETS = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']);

function pointOnRing(degrees: number, radius: number): THREE.Vector2 {
  const angle = THREE.MathUtils.degToRad(degrees);
  return new THREE.Vector2(-Math.sin(angle) * radius, Math.cos(angle) * radius);
}

/** Format the astronomical longitude within its sign, rounding across 30° safely. */
export function formatAxisDms(longitude: number): string {
  const seconds = Math.round(((((longitude % 30) + 30) % 30) * 3600)) % (30 * 3600);
  const degrees = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${degrees}°${String(minutes).padStart(2, '0')}′${String(seconds % 60).padStart(2, '0')}″`;
}

/** MC caption in decimal degrees, rounded to one tenth within its sign. */
export function formatAxisDegreeTenths(longitude: number): string {
  const tenths = Math.round(((((longitude % 30) + 30) % 30) * 10)) % 300;
  return `${Math.floor(tenths / 10)},${tenths % 10}°`;
}

/** Compact ASC annotation: sign degrees and the two arcsecond digits only. */
export function formatAxisDegreeSeconds(longitude: number): string {
  const arcseconds = Math.round(((((longitude % 30) + 30) % 30) * 3600)) % (30 * 3600);
  return `${Math.floor(arcseconds / 3600)}°${String(arcseconds % 60).padStart(2, '0')}″`;
}

/** Uses the actual diurnal/nocturnal intervals from VirgoStars' astrology backend. */
export function planetaryHourAt(orePlanetarie: any): string | null {
  const time = orePlanetarie?.dataora;
  const alba = orePlanetarie?.alba;
  const tramonto = orePlanetarie?.tramonto;
  const albaSucc = orePlanetarie?.albaSucc;
  if (![time, alba, tramonto, albaSucc].every(value => typeof value === 'string')) return null;
  const comparable = (value: string) => value.slice(0, 19).replace('T', ' ');
  const instant = comparable(time);
  if (instant < comparable(alba) || instant >= comparable(albaSucc)) return null;
  const isDay = instant < comparable(tramonto);
  const hours = isDay ? orePlanetarie?.dh?.diurne : orePlanetarie?.dh?.notturne;
  if (!Array.isArray(hours) || hours.length !== 12) return null;
  const entry = [...hours].reverse().find(hour =>
    typeof hour?.dataora === 'string' && comparable(hour.dataora) <= instant);
  return typeof entry?.pianeta === 'string' && HOUR_PLANETS.has(entry.pianeta) ? entry.pianeta : null;
}

function axisLine(a: THREE.Vector2, b: THREE.Vector2, color: string, z = 0.015): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(a.x, a.y, z), new THREE.Vector3(b.x, b.y, z),
  ]);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.92 }));
}

/** Two fine strokes form a traditional, unfilled arrowhead. */
function openArrowhead(angle: number, radius: number, color: string): THREE.LineSegments {
  const tip = pointOnRing(angle, radius);
  const base = pointOnRing(angle, radius - 0.095);
  const tangent = pointOnRing(angle + 90, 0.045);
  const sides = [base.clone().add(tangent), tip, base.clone().sub(tangent), tip];
  const geometry = new THREE.BufferGeometry().setFromPoints(
    sides.map(point => new THREE.Vector3(point.x, point.y, 0.022)));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }));
}

function textLabel(value: string, color: string, width: number, height: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossibile creare il testo degli assi');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = 'bold 94px Arial, sans-serif';
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.fillStyle = color;
  context.fillText(value, canvas.width / 2, canvas.height / 2, canvas.width - 28);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  mesh.position.z = 0.03;
  mesh.userData.axisLabel = value;
  return mesh;
}

/** Restrained hand-drawn-style axis markers, independently switchable. */
export class MarcatoriAssiRender {
  public static async creaMarcatori(asc: number, mc: number, zodiacRadius: number,
    opzioni: any, temaRender: any, degreeTickRadius = zodiacRadius * 103 / 120): Promise<THREE.Group> {
    const group = new THREE.Group();
    const ascAngle = 90;
    const dsAngle = 270;
    const mcAngle = 90 - asc + mc;
    const icAngle = mcAngle + 180;

    // The axis stems end at the precise longitude tick on the *inner zodiac
    // rim*. They do not extend inward across the planets toward the houses.
    const addStem = (key: string, angle: number, tipRadius: number, color: string) => {
      const stem = axisLine(pointOnRing(angle, degreeTickRadius),
        pointOnRing(angle, tipRadius), color);
      stem.userData.axisStem = key;
      group.add(stem);
      return stem;
    };

    // Like the traditional hand-drawn natal chart: an open V at the end of a
    // thin axis line, not a triangle with a wide base.
    const makeAscPointer = () => {
      addStem('ASC', ascAngle, zodiacRadius + 0.47, AXIS_PALETTE.asc);
      const pointer = openArrowhead(ascAngle, zodiacRadius + 0.47, AXIS_PALETTE.asc);
      pointer.userData.axisMarker = 'ASC';
      group.add(pointer);
    };

    // The descending axis has the same visible terminal dot as the IC.
    const makeDsLine = () => {
      const tip = pointOnRing(dsAngle, zodiacRadius + 0.38);
      addStem('DS', dsAngle, zodiacRadius + 0.38, AXIS_PALETTE.ds);
      const dot = new THREE.Points(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(tip.x, tip.y, 0.024),
      ]), new THREE.PointsMaterial({ color: AXIS_PALETTE.ds, size: 6, sizeAttenuation: false }));
      dot.userData.axisMarker = 'DS';
      group.add(dot);
    };

    // MC repeats the same simple arrow vocabulary as ASC.
    const makeMcPointer = () => {
      const angle = mcAngle;
      addStem('MC', angle, zodiacRadius + 0.48, AXIS_PALETTE.mc);
      const pointer = openArrowhead(angle, zodiacRadius + 0.48, AXIS_PALETTE.mc);
      pointer.userData.axisMarker = 'MC';
      group.add(pointer);
    };

    // A small terminal point, as in the photographed Imum Coeli axis.
    const makeIcLine = () => {
      const tip = pointOnRing(icAngle, zodiacRadius + 0.39);
      addStem('IC', icAngle, zodiacRadius + 0.39, AXIS_PALETTE.ic);
      const marker = new THREE.Points(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(tip.x, tip.y, 0.024),
      ]), new THREE.PointsMaterial({ color: AXIS_PALETTE.ic, size: 6, sizeAttenuation: false }));
      marker.userData.axisMarker = 'IC';
      group.add(marker);
    };

    if (opzioni.mostraFrecciaAscendente !== false) makeAscPointer();
    if (opzioni.mostraRetroFrecciaDiscendente !== false) makeDsLine();
    if (opzioni.mostraFrecciaMC !== false) makeMcPointer();
    if (opzioni.mostraRetroFrecciaIC !== false) makeIcLine();

    if (opzioni.mostraGradiAssi !== false) {
      for (const [key, longitude, angle, color, radialOffset, tangentOffset] of [
        // Centre the degree between the zodiac's outer edge and the base of
        // the arrowhead, slightly above the shaft (clear of the line).
        ['ASC', asc, ascAngle, AXIS_PALETTE.asc, 0.1875, -0.035],
        // MC: the degree is beside the *left* of the rising MC arrow.
        ['MC', mc, mcAngle, AXIS_PALETTE.mc, 0.36, 0.315],
      ] as const) {
        const label = textLabel(key === 'ASC' ? formatAxisDegreeSeconds(longitude) : formatAxisDegreeTenths(longitude),
          color, key === 'ASC' ? 0.32 : 0.47, key === 'ASC' ? 0.10 : 0.12);
        const position = pointOnRing(angle, zodiacRadius + radialOffset)
          .add(pointOnRing(angle + 90, tangentOffset));
        label.position.x = position.x;
        label.position.y = position.y;
        label.userData.axis = key;
        group.add(label);
      }
    }

    if (opzioni.mostraOraPlanetariaAscendente !== false) {
      const name = planetaryHourAt(temaRender?.orePlanetarie);
      if (name) {
        // Share the degree's radial midpoint so both are centred over the
        // arrow shaft. Stack the planetary ruler *above* the ASC degree.
        const position = pointOnRing(ascAngle, zodiacRadius + 0.1875)
          .add(pointOnRing(ascAngle + 90, -0.18));
        // Use the owner's real, skin-tinted chart asset. Unicode planet
        // characters vary by font and don't match the chart's glyph family.
        const glyph = await OggettiSempliciRender.getImg(
          `simboli-bianchi/elementi-celesti/${name}.png`, 875, 605, 1 / 875,
          false, AXIS_PALETTE.asc,
        );
        glyph.scale.set(0.21, 0.21, 1);
        glyph.position.set(position.x, position.y, 0.031);
        glyph.userData.axis = 'planetary-hour-glyph';
        glyph.userData.planetaryHour = name;
        group.add(glyph);
      }
    }

    if (opzioni.mostraDirezioneMotoMC !== false && opzioni.mostraFrecciaMC !== false) {
      // For an ordinary instantaneous sky the MC moves toward increasing
      // ecliptic longitude. A caller supplying a computed signed velocity can
      // override this (e.g. in a progressed/direct chart).
      const house = temaRender?.houses?.[opzioni?.settaggi?.domificazione_selezionata];
      const speed = house?.mcSpeed ?? temaRender?.mcSpeed ?? 1;
      if (Number.isFinite(speed) && speed !== 0) {
        // A filled directional triangle sits with its base exactly on the
        // shaft, approximately halfway along the external MC arrow.
        const radius = zodiacRadius + 0.23;
        const baseA = pointOnRing(mcAngle, radius - 0.038);
        const baseB = pointOnRing(mcAngle, radius + 0.038);
        const tip = pointOnRing(mcAngle, radius)
          .add(pointOnRing(mcAngle + (speed > 0 ? 90 : -90), 0.095));
        const shape = new THREE.Shape();
        shape.moveTo(baseA.x, baseA.y);
        shape.lineTo(baseB.x, baseB.y);
        shape.lineTo(tip.x, tip.y);
        shape.closePath();
        const marker = new THREE.Mesh(new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({ color: '#b58bd8', side: THREE.DoubleSide }));
        marker.position.z = 0.024;
        marker.userData.axisMarker = 'MC-motion';
        group.add(marker);
      }
    }

    return group;
  }
}
