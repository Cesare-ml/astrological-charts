/** Consumers can gate the control when an older renderer package is installed. */
export const SYNASTRY_DEFLECTION_VERSION = 1;

/** Rendering offset for Regolo's deflection in the Vehlow (egizia) wheel. */
export function synastryDeflectionOffset(referenceAsc: number, partnerAsc: number, house: number): number {
  if (!Number.isFinite(referenceAsc) || !Number.isFinite(partnerAsc) || !Number.isInteger(house) || house < 1 || house > 12)
    throw new RangeError('Deflection requires finite ascendants and a house from 1 to 12');
  return (house - 1) * 30 + referenceAsc - partnerAsc;
}
