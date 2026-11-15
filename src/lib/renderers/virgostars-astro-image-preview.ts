/**
 * Opt-in mapping from the host's legacy chart glyph references to the
 * separately staged, owner-approved VirgoStars Astro v0.2 alpha masks.
 *
 * No proprietary images, fonts or SVG outlines are included in this library.
 * The masks are WHITE RGB + the approved glyph's exact alpha so the existing
 * Three.js MeshBasicMaterial color tint works on both light and dark skins.
 */
const ZODIAC = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const;

const BODIES: Readonly<Record<string, string>> = Object.freeze({
  Sun: 'sun', Moon: 'moon', Mercury: 'mercury', Venus: 'venus',
  Mars: 'mars', Jupiter: 'jupiter', Saturn: 'saturn',
  Uranus: 'uranus', Neptune: 'neptune', Pluto: 'pluto',
});

// Only the exact legacy references below are eligible. Do not replace
// retrograde glyphs, chart axes, asteroids, houses, decan glyphs or latitude art.
const PREFIX = '((?:\\.\\./){3}assets/img/|/assets/img/|assets/img/|img/)?';
const SIGN_REF = new RegExp('^' + PREFIX + 'simboli-bianchi/segni/(0[1-9]|1[0-2])\\.png$');
const BODY_REF = new RegExp('^' + PREFIX +
  'simboli-bianchi/elementi-celesti/(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)\\.png$');

/** Return a replacement reference ONLY for eligible glyphs; never a network URL. */
export function getVirgoStarsAstroImageOverride(reference: string): string | null {
  if (typeof reference !== 'string') return null;
  const sign = SIGN_REF.exec(reference);
  if (sign) {
    return (sign[1] ?? '') + 'virgostars-astro/masks/' +
      ZODIAC[Number(sign[2]) - 1] + '.png';
  }
  const body = BODY_REF.exec(reference);
  if (body) {
    return (body[1] ?? '') + 'virgostars-astro/masks/' +
      BODIES[body[2]] + '.png';
  }
  return null;
}
