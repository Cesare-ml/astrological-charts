import type { MonomericCrossView, MonomericCrossArmView, MonomericCrossPosition } from './monomeric-cross.component';

/** Structural contract only: the calculating package is not a dependency of the renderer. */
export interface MonomericCrossGeometryLike {
  hourRuler: string;
  houseSystemId: string;
  arms: readonly {
    role: string;
    longitudeDeg: number;
    signIndex: number;
    house: number | null;
    signRuler: string;
    rulerLongitudeDeg: number;
    rulerHouse: number | null;
  }[];
}

const SIGNS = {
  it: ['Ariete','Toro','Gemelli','Cancro','Leone','Vergine','Bilancia','Scorpione','Sagittario','Capricorno','Acquario','Pesci'],
  en: ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'],
} as const;
const PLANETS: Record<string, readonly [string,string]> = {
  SUN: ['Sole','Sun'], MOON: ['Luna','Moon'], MERCURY: ['Mercurio','Mercury'],
  VENUS: ['Venere','Venus'], MARS: ['Marte','Mars'],
  JUPITER: ['Giove','Jupiter'], SATURN: ['Saturno','Saturn'],
};
const POSITIONS: readonly MonomericCrossPosition[] = ['master','square-left','square-right','opposite'];

/** Render bare geometric facts until a separately verified historical source is provided. */
export function monomericCrossViewFromGeometry(
  geometry: MonomericCrossGeometryLike,
  locale: 'it' | 'en' = 'it',
): MonomericCrossView {
  if (!geometry || geometry.arms.length !== 4 ||
      geometry.arms.some((arm, index) => arm.role !== POSITIONS[index] ||
        !Number.isInteger(arm.signIndex) || arm.signIndex < 0 || arm.signIndex > 11)) {
    throw new Error('Invalid or incomplete monomeric cross geometry');
  }
  const translatedPlanet = (key: string): string => PLANETS[key]?.[locale === 'it' ? 0 : 1] ?? key;
  const arms: MonomericCrossArmView[] = geometry.arms.map(arm => ({
    position: arm.role as MonomericCrossPosition,
    sign: SIGNS[locale][arm.signIndex],
    longitudeDeg: arm.longitudeDeg,
    house: arm.house,
    signRuler: translatedPlanet(arm.signRuler),
    rulerSign: SIGNS[locale][Math.floor((((arm.rulerLongitudeDeg % 360) + 360) % 360) / 30)],
    rulerHouse: arm.rulerHouse,
    description: null,
    rulerDescription: null,
  }));
  return {
    hourRuler: translatedPlanet(geometry.hourRuler),
    houseSystem: geometry.houseSystemId,
    degreeConvention: null,
    catalogAttribution: null,
    arms,
  };
}
