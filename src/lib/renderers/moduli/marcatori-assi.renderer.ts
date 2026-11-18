import * as THREE from 'three';
import { OggettiSempliciRender } from '../oggetti-semplici.renderer';
import { SkinManager } from '../@skin-manager';

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

/** Readable axis caption: sign degrees and whole arcminutes, without padding. */
export function formatAxisDegreeMinutes(longitude: number): string {
  const minutes = Math.round(((((longitude % 30) + 30) % 30) * 60)) % (30 * 60);
  return `${Math.floor(minutes / 60)}° ${minutes % 60}′`;
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

/** Two straight strokes with the measured reference V proportions. */
function openArrowhead(angle: number, radius: number, color: string): THREE.LineSegments {
  const tip = pointOnRing(angle, radius);
  const base = pointOnRing(angle, radius - 0.075);
  const tangent = pointOnRing(angle + 90, 0.043);
  const sides = [base.clone().add(tangent), tip, base.clone().sub(tangent), tip];
  const geometry = new THREE.BufferGeometry().setFromPoints(
    sides.map(point => new THREE.Vector3(point.x, point.y, 0.022)));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }));
}

/** Three.js points render as squares without a texture; a real disc stays round. */
function circularTerminal(angle: number, radius: number, color: string): THREE.Mesh {
  const position = pointOnRing(angle, radius);
  const marker = new THREE.Mesh(new THREE.CircleGeometry(0.033, 32),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  marker.position.set(position.x, position.y, 0.024);
  return marker;
}

function textLabel(value: string, color: string, width: number, height: number,
  font = 'bold 94px Arial, sans-serif'): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossibile creare il testo degli assi');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = font;
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
  /** The moving chart's own axes, oriented to the natal ascendant. */
  public static creaMarcatoriTransiti(ascRef: number, asc: number, mc: number,
    zodiacRadius: number, transitRadius: number, opzioni: any): THREE.Group {
    const group = new THREE.Group();
    group.userData.chartInteractionRole = 'transit-axes';
    const colors = SkinManager.getAxisColors(opzioni?.settaggi?.skin_id);
    const axes = [
      {key:'ASC', name:'AS', longitude:asc, angle:90 - ascRef + asc, color:colors.asc, arrow:true},
      {key:'DS', name:'DS', longitude:(asc + 180) % 360, angle:270 - ascRef + asc, color:colors.ds, arrow:false},
      {key:'MC', name:'MC', longitude:mc, angle:90 - ascRef + mc, color:colors.mc, arrow:true},
      {key:'IC', name:'IC', longitude:(mc + 180) % 360, angle:270 - ascRef + mc, color:colors.ic, arrow:false},
    ];
    for (const axis of axes) {
      const start = pointOnRing(axis.angle, zodiacRadius + 0.02);
      const end = pointOnRing(axis.angle, transitRadius + 0.10);
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(start.x,start.y,0.035), new THREE.Vector3(end.x,end.y,0.035),
      ]);
      const stem = new THREE.Line(geometry, new THREE.LineDashedMaterial({color:axis.color, dashSize:0.055, gapSize:0.035}));
      stem.computeLineDistances();
      stem.userData.axisStem = axis.key;
      stem.userData.planet = axis.name;
      stem.userData.trueLongitude = ((axis.longitude % 360) + 360) % 360;
      group.add(stem);
      const marker = axis.arrow ? openArrowhead(axis.angle, transitRadius + 0.10, axis.color)
        : circularTerminal(axis.angle, transitRadius + 0.10, axis.color);
      marker.userData.axisMarker = axis.key;
      marker.userData.planet = axis.name;
      marker.userData.trueLongitude = stem.userData.trueLongitude;
      marker.position.z = 0.04;
      group.add(marker);
    }
    return group;
  }

  /** In transit charts preserve the four axis strokes, but not their labels. */
  public static getPresentationOptions(opzioni: any): any {
    return opzioni?.mostraTransiti === true ? {
      ...opzioni,
      mostraNomiAssi: false,
      mostraGradiAssi: false,
      mostraOraPlanetariaAscendente: false,
      mostraDirezioneMotoMC: false,
    } : opzioni;
  }

  public static async creaMarcatori(asc: number, mc: number, zodiacRadius: number,
    opzioni: any, temaRender: any, degreeTickRadius = zodiacRadius * 103 / 120): Promise<THREE.Group> {
    const group = new THREE.Group();
    const colors = SkinManager.getAxisColors(opzioni?.settaggi?.skin_id);
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
      addStem('ASC', ascAngle, zodiacRadius + 0.17, colors.asc);
      const pointer = openArrowhead(ascAngle, zodiacRadius + 0.17, colors.asc);
      pointer.userData.axisMarker = 'ASC';
      group.add(pointer);
    };

    // The descending axis has the same visible terminal dot as the IC.
    const makeDsLine = () => {
      addStem('DS', dsAngle, zodiacRadius + 0.22, colors.ds);
      const dot = circularTerminal(dsAngle, zodiacRadius + 0.22, colors.ds);
      dot.userData.axisMarker = 'DS';
      group.add(dot);
    };

    // MC repeats the same simple arrow vocabulary as ASC.
    const makeMcPointer = () => {
      const angle = mcAngle;
      addStem('MC', angle, zodiacRadius + 0.18, colors.mc);
      const pointer = openArrowhead(angle, zodiacRadius + 0.18, colors.mc);
      pointer.userData.axisMarker = 'MC';
      group.add(pointer);
    };

    // A small terminal point, as in the photographed Imum Coeli axis.
    const makeIcLine = () => {
      addStem('IC', icAngle, zodiacRadius + 0.22, colors.ic);
      const marker = circularTerminal(icAngle, zodiacRadius + 0.22, colors.ic);
      marker.userData.axisMarker = 'IC';
      group.add(marker);
    };

    if (opzioni.mostraFrecciaAscendente !== false) makeAscPointer();
    if (opzioni.mostraRetroFrecciaDiscendente !== false) makeDsLine();
    if (opzioni.mostraFrecciaMC !== false) makeMcPointer();
    if (opzioni.mostraRetroFrecciaIC !== false) makeIcLine();

    if (opzioni.mostraNomiAssi !== false) {
      // These four headings are drawn from a real serif font on canvas,
      // never loaded as glyphs from astrological-assets. Their layout is
      // universal; only the text color remains skin-specific.
      for (const [key, title, angle, shift, tangentShift, visible] of [
        ['ASC', 'ASC', ascAngle, 0.41, -0.063, opzioni.mostraFrecciaAscendente !== false],
        ['DS', 'DS', dsAngle, 0.41, 0, opzioni.mostraRetroFrecciaDiscendente !== false],
        ['MC', 'MC', mcAngle, 0.45, 0, opzioni.mostraFrecciaMC !== false],
        ['IC', 'IC', icAngle, 0.43, 0, opzioni.mostraRetroFrecciaIC !== false],
      ] as const) {
        if (!visible) continue;
        // Canvas is 512×160 (3.2:1). Matching that aspect ratio on the plane
        // avoids the previous ~45% horizontal compression of all axis names.
        const label = textLabel(title, colors.testo, 0.77, 0.24,
          'bold 114px "Times New Roman", Georgia, serif');
        const position = pointOnRing(angle, zodiacRadius + shift)
          .add(pointOnRing(angle + 90, tangentShift));
        label.position.x = position.x;
        label.position.y = position.y;
        label.userData.axisName = key;
        group.add(label);
      }
    }

    if (opzioni.mostraGradiAssi !== false) {
      for (const [key, longitude, angle, color, radialOffset, tangentOffset] of [
        // ASC: beyond the arrowhead, directly UNDER the ASC heading.
        ['ASC', asc, ascAngle, colors.asc, 0.41, 0.12],
        // MC: centered on the axis, between the shortened arrow and MC title.
        ['MC', mc, mcAngle, colors.mc, 0.30, 0],
      ] as const) {
        const label = textLabel(formatAxisDegreeMinutes(longitude),
          color, 0.64, 0.18, 'normal 102px "Times New Roman", Georgia, serif');
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
        // Centre the planetary hour exactly above the ASC heading, not above
        // the arrow's shaft (the hour and heading share a radial bearing).
        const position = pointOnRing(ascAngle, zodiacRadius + 0.41)
          .add(pointOnRing(ascAngle + 90, -0.30));
        // Use the owner's real, skin-tinted chart asset. Unicode planet
        // characters vary by font and don't match the chart's glyph family.
        const glyph = await OggettiSempliciRender.getImg(
          `simboli-bianchi/elementi-celesti/${name}.png`, 875, 605, 1 / 875,
          false, colors.asc,
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
        // Centre the directional triangle halfway between the zodiac edge
        // and the beginning of the MC arrowhead, well below the open V.
        const radius = zodiacRadius + (0.18 - 0.075) / 2;
        const baseA = pointOnRing(mcAngle, radius - 0.019);
        const baseB = pointOnRing(mcAngle, radius + 0.019);
        const tip = pointOnRing(mcAngle, radius)
          .add(pointOnRing(mcAngle + (speed > 0 ? 90 : -90), 0.047));
        const shape = new THREE.Shape();
        shape.moveTo(baseA.x, baseA.y);
        shape.lineTo(baseB.x, baseB.y);
        shape.lineTo(tip.x, tip.y);
        shape.closePath();
        const marker = new THREE.Mesh(new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({ color: colors.motoMC, side: THREE.DoubleSide }));
        marker.position.z = 0.024;
        marker.userData.axisMarker = 'MC-motion';
        group.add(marker);
      }
    }

    // The external stems, arrowheads, terminal dots and labels remain pickable
    // even when the duplicate axis glyphs inside the planet ring are hidden.
    const longitudes: Record<string, number> = {ASC:asc, DS:(asc+180)%360, MC:mc, IC:(mc+180)%360};
    for (const object of group.children) {
      const key = object.userData.axisName ?? object.userData.axisMarker ?? object.userData.axisStem ?? object.userData.axis;
      if (typeof key === 'string' && Object.prototype.hasOwnProperty.call(longitudes, key)) {
        object.userData.planet = key === 'ASC' ? 'AS' : key;
        object.userData.trueLongitude = longitudes[key];
      }
    }
    group.userData.chartInteractionRole = 'natal-axes';
    return group;
  }
}
