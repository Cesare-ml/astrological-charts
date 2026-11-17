import * as THREE from 'three';

const AXIS_PALETTE = {
  asc: '#e98130',
  ds: '#21ae7c',
  mc: '#8a45dd',
  ic: '#b7a0e7',
};

const HOUR_GLYPHS: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄',
};

function pointOnRing(degrees: number, radius: number): THREE.Vector2 {
  const angle = THREE.MathUtils.degToRad(degrees);
  return new THREE.Vector2(-Math.sin(angle) * radius, Math.cos(angle) * radius);
}

/** Format the astronomical longitude within its sign, rounding across 30° safely. */
export function formatAxisDms(longitude: number): string {
  const seconds = Math.round(((((longitude % 30) + 30) % 30) * 3600)) % (30 * 3600);
  const degrees = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${degrees}° ${String(minutes).padStart(2, '0')}′ ${String(seconds % 60).padStart(2, '0')}″`;
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
  return typeof entry?.pianeta === 'string' && HOUR_GLYPHS[entry.pianeta] ? entry.pianeta : null;
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

function textLabel(value: string, color: string, width: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossibile creare il testo degli assi');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '600 70px Arial, sans-serif';
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.fillStyle = color;
  context.fillText(value, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 5),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  mesh.position.z = 0.03;
  mesh.userData.axisLabel = value;
  return mesh;
}

/** Distinctly styled markers, outside the zodiac and independently switchable. */
export class MarcatoriAssiRender {
  public static creaMarcatori(asc: number, mc: number, zodiacRadius: number, opzioni: any, temaRender: any): THREE.Group {
    const group = new THREE.Group();
    const ascAngle = 90;
    const dsAngle = 270;
    const mcAngle = 90 - asc + mc;
    const icAngle = mcAngle + 180;

    const makeArrow = (angle: number, color: string, key: string) => {
      const stemEnd = zodiacRadius + 0.30;
      group.add(axisLine(pointOnRing(angle, zodiacRadius - 0.02), pointOnRing(angle, stemEnd), color));
      const tip = pointOnRing(angle, zodiacRadius + 0.46);
      const baseCenter = pointOnRing(angle, stemEnd);
      const tangent = pointOnRing(angle + 90, 0.115);
      const arrow = solidPolygon([
        tip, baseCenter.clone().add(tangent), baseCenter.clone().sub(tangent),
      ], color);
      arrow.userData.axisMarker = key;
      group.add(arrow);
      return tip;
    };

    const makeTail = (angle: number, color: string, key: string) => {
      const center = pointOnRing(angle, zodiacRadius + 0.40);
      group.add(axisLine(pointOnRing(angle, zodiacRadius - 0.02), pointOnRing(angle, zodiacRadius + 0.31), color));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.068, 0.087, 40),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
      ring.position.set(center.x, center.y, 0.018);
      ring.userData.axisMarker = key;
      group.add(ring);
    };

    if (opzioni.mostraFrecciaAscendente !== false) makeArrow(ascAngle, AXIS_PALETTE.asc, 'ASC');
    if (opzioni.mostraRetroFrecciaDiscendente !== false) makeTail(dsAngle, AXIS_PALETTE.ds, 'DS');
    if (opzioni.mostraFrecciaMC !== false) makeArrow(mcAngle, AXIS_PALETTE.mc, 'MC');
    if (opzioni.mostraRetroFrecciaIC !== false) makeTail(icAngle, AXIS_PALETTE.ic, 'IC');

    if (opzioni.mostraGradiAssi !== false) {
      for (const [key, longitude, angle, color, tangentOffset] of [
        ['ASC', asc, ascAngle, AXIS_PALETTE.asc, -0.19],
        ['MC', mc, mcAngle, AXIS_PALETTE.mc, -0.19],
      ] as const) {
        const label = textLabel(formatAxisDms(longitude), color, 0.39);
        const position = pointOnRing(angle, zodiacRadius + 0.46)
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
        const label = textLabel(`Ora ${HOUR_GLYPHS[name]}`, AXIS_PALETTE.asc, 0.30);
        const position = pointOnRing(ascAngle, zodiacRadius + 0.42)
          .add(pointOnRing(ascAngle + 90, 0.20));
        label.position.x = position.x;
        label.position.y = position.y;
        label.userData.axis = 'planetary-hour';
        group.add(label);
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
