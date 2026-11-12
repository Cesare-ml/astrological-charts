/**
 * Guard offscreen PNG export allocation before creating a canvas or WebGL
 * context. The limits bound the requested pixel buffer independently of any
 * particular GPU's MAX_RENDERBUFFER_SIZE (which can be lower).
 *
 * No image scaling is changed for valid requests; the existing renderer
 * continues to apply the caller's pixel ratio and CSS dimensions.
 */
export const MAX_CHART_EXPORT_EDGE = 8192;
export const MAX_CHART_EXPORT_PIXELS = 32 * 1024 * 1024;

export function validateChartExportDimensions(
  dimensions: { x: number; y: number },
  scale: number
): void {
  if (!dimensions || !Number.isSafeInteger(dimensions.x) || !Number.isSafeInteger(dimensions.y)
      || dimensions.x <= 0 || dimensions.y <= 0) {
    throw new RangeError('Chart PNG export dimensions must be positive safe integers.');
  }
  // A fractional pixel ratio is valid (e.g. 1.5 for a Retina preview).
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('Chart PNG export scale must be finite and positive.');
  }
  const width = dimensions.x * scale;
  const height = dimensions.y * scale;
  if (!Number.isFinite(width) || !Number.isFinite(height)
      || width < 1 || height < 1
      || width > MAX_CHART_EXPORT_EDGE || height > MAX_CHART_EXPORT_EDGE
      || width * height > MAX_CHART_EXPORT_PIXELS) {
    throw new RangeError('Chart PNG export exceeds the supported pixel budget.');
  }
}
