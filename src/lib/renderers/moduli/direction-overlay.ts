export const REGOLO_DIRECTIONS_RENDER_VERSION = 1;

/** Display offsets only: the caller supplies already calculated chart facts. */
export function directionOverlayOffsets(radixAsc: number, directedAsc: number, mode: string, arc: number): {geometry:number; symbolicAxis:number} {
  if (![radixAsc, directedAsc, arc].every(Number.isFinite) || !['primarieSemplificate','simboliche'].includes(mode))
    throw new RangeError('Invalid direction overlay');
  return {geometry:radixAsc-directedAsc, symbolicAxis:mode === 'primarieSemplificate' ? arc : 0};
}
