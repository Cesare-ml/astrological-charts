/** Display coordinate on the radix-anchored, left-to-right zodiac strip. */
export function solarReturnStripPosition(longitude:number, radixFirstCusp:number):number {
  return (((longitude - radixFirstCusp) % 360 + 360) % 360) / 3.6;
}
