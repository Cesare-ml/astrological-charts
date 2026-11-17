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

function solidPolygon(points: THREE.Vector2[], color: string, z = 0.018): THREE.Mesh {
  const shape = new THREE.Shape();
  points.forEach((point, index) => index === 0 ? shape.moveTo(point.x, point.y) : shape.lineTo(point.x, point.y));
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  mesh.position.z = z;
  return mesh;
}

function outlinePolygon(points: THREE.Vector2[], color: string): THREE.LineLoop {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, p.y, 0.022)));
  return new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({color}));
}

function textLabel(value: string, color: string, width: number, height: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossibile creare il testo degli assi');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = 'bold 96px Arial, sans-serif';
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

/** Distinctly styled markers, outside the zodiac and independently switchable. */
export class MarcatoriAssiRender {
  public static async creaMarcatori(asc: number, mc: number, zodiacRadius: number, opzioni: any, temaRender: any): Promise<THREE.Group> {
    const group = new THREE.Group();
    const ascAngle = 90;
    const dsAngle = 270;
    const mcAngle = 90 - asc + mc;
    const icAngle = mcAngle + 180;

    // ASC: two open, offset chevrons, evoking an ascending signal rather than
    // the solid triangular marker of the reference chart.
    const makeAscChevron = () => {
      group.add(axisLine(pointOnRing(ascAngle, zodiacRadius - 0.02),
        pointOnRing(ascAngle, zodiacRadius + 0.35), AXIS_PALETTE.asc));
      for (const [tipRadius, span] of [[0.44, 0.095], [0.53, 0.07]]) {
        const tip = pointOnRing(ascAngle, zodiacRadius + tipRadius);
        const base = pointOnRing(ascAngle, zodiacRadius + tipRadius - 0.12);
        const t = pointOnRing(ascAngle + 90, span);
        group.add(axisLine(base.clone().add(t), tip, AXIS_PALETTE.asc));
        group.add(axisLine(base.clone().sub(t), tip, AXIS_PALETTE.asc));
      }
      const end = pointOnRing(ascAngle, zodiacRadius + 0.535);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.025, 16),
        new THREE.MeshBasicMaterial({color: AXIS_PALETTE.asc}));
      dot.position.set(end.x, end.y, 0.025);
      dot.userData.axisMarker = 'ASC';
      group.add(dot);
    };

    // DS: a bracketed gate with a flat stop, unlike a circular arrow tail.
    const makeDsGate = () => {
      const angle = dsAngle;
      group.add(axisLine(pointOnRing(angle, zodiacRadius - 0.02),
        pointOnRing(angle, zodiacRadius + 0.37), AXIS_PALETTE.ds));
      const left = pointOnRing(angle + 90, 0.095);
      const end = pointOnRing(angle, zodiacRadius + 0.41);
      const inner = pointOnRing(angle, zodiacRadius + 0.28);
      group.add(axisLine(end.clone().add(left), end.clone().sub(left), AXIS_PALETTE.ds));
      group.add(axisLine(end.clone().add(left), inner.clone().add(left), AXIS_PALETTE.ds));
      const bar = axisLine(end.clone().sub(left), inner.clone().sub(left), AXIS_PALETTE.ds);
      bar.userData.axisMarker = 'DS';
      group.add(bar);
    };

    // MC: a tapered compass vane with a notched base; its golden directional
    // pointer is distinct from the purple body.
    const makeMcVane = () => {
      const angle = mcAngle;
      group.add(axisLine(pointOnRing(angle, zodiacRadius - 0.02),
        pointOnRing(angle, zodiacRadius + 0.25), AXIS_PALETTE.mc));
      const stem = pointOnRing(angle, zodiacRadius + 0.32);
      const t = pointOnRing(angle + 90, 0.105);
      const blade = solidPolygon([
        pointOnRing(angle, zodiacRadius + 0.55),
        stem.clone().add(t),
        pointOnRing(angle, zodiacRadius + 0.39),
        stem.clone().sub(t),
      ], AXIS_PALETTE.mc);
      blade.userData.axisMarker = 'MC';
      group.add(blade);
      group.add(outlinePolygon([
        pointOnRing(angle, zodiacRadius + 0.55), stem.clone().add(t),
        pointOnRing(angle, zodiacRadius + 0.24), stem.clone().sub(t),
      ], '#9a70df'));
    };

    // IC: an open, faceted cradle. No circular outline or filled arrowhead.
    const makeIcCradle = () => {
      const angle = icAngle;
      const center = pointOnRing(angle, zodiacRadius + 0.39);
      const radial = pointOnRing(angle, 0.11);
      const tangent = pointOnRing(angle + 90, 0.105);
      group.add(axisLine(pointOnRing(angle, zodiacRadius - 0.02),
        pointOnRing(angle, zodiacRadius + 0.25), AXIS_PALETTE.ic));
      const frame = outlinePolygon([
        center.clone().add(radial), center.clone().add(tangent),
        center.clone().sub(radial), center.clone().sub(tangent),
      ], AXIS_PALETTE.ic);
      frame.userData.axisMarker = 'IC';
      group.add(frame);
      group.add(axisLine(center.clone().add(tangent), center.clone().sub(tangent), AXIS_PALETTE.ic));
    };

    if (opzioni.mostraFrecciaAscendente !== false) makeAscChevron();
    if (opzioni.mostraRetroFrecciaDiscendente !== false) makeDsGate();
    if (opzioni.mostraFrecciaMC !== false) makeMcVane();
    if (opzioni.mostraRetroFrecciaIC !== false) makeIcCradle();

    if (opzioni.mostraGradiAssi !== false) {
      for (const [key, longitude, angle, color, tangentOffset] of [
        ['ASC', asc, ascAngle, AXIS_PALETTE.asc, -0.28],
        ['MC', mc, mcAngle, AXIS_PALETTE.mc, -0.28],
      ] as const) {
        const label = textLabel(formatAxisDms(longitude), color, 0.78, 0.23);
        const position = pointOnRing(angle, zodiacRadius + 0.25)
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
        const label = textLabel('Ora', AXIS_PALETTE.asc, 0.30, 0.19);
        const position = pointOnRing(ascAngle, zodiacRadius + 0.25)
          .add(pointOnRing(ascAngle + 90, 0.27));
        label.position.x = position.x + 0.11;
        label.position.y = position.y;
        label.userData.axis = 'planetary-hour';
        group.add(label);

        // Use the owner's real, skin-tinted chart asset. Unicode planet
        // characters vary by font and don't match the chart's glyph family.
        const glyph = await OggettiSempliciRender.getImg(
          `simboli-bianchi/elementi-celesti/${name}.png`, 875, 605, 1 / 875,
          false, AXIS_PALETTE.asc,
        );
        glyph.scale.set(0.21, 0.21, 1);
        glyph.position.set(position.x - 0.16, position.y, 0.031);
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
        const center = pointOnRing(mcAngle, zodiacRadius + 0.365);
        const tangent = pointOnRing(mcAngle + (speed > 0 ? 90 : -90), 0.055);
        const radial = pointOnRing(mcAngle, 0.045);
        const marker = solidPolygon([
          center.clone().add(tangent), center.clone().sub(tangent).add(radial),
          center.clone().sub(tangent).sub(radial),
        ], '#ffdf73', 0.024);
        marker.userData.axisMarker = 'MC-motion';
        group.add(marker);
      }
    }

    return group;
  }
}
