/**
 * Choose the more contrasting black/white antiscia marker against the skin background.
 * Current skin backgrounds are CSS hex colors; keep the legacy white fallback for
 * unknown/custom background formats rather than changing unrelated rendering.
 */
export function getAntisciMarkerColor(background: string): '#000000' | '#ffffff' {
  if (typeof background !== 'string') return '#ffffff';
  const hex = background.trim().replace(/^#/, '');
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) || !background.trim().startsWith('#')) {
    return '#ffffff';
  }

  const channels = hex.length === 3
    ? [...hex].map((digit) => parseInt(digit + digit, 16))
    : [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const linear = channels.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];

  // WCAG contrast ratios favor black for L > sqrt(0.0525) - 0.05.
  return luminance > Math.sqrt(0.0525) - 0.05 ? '#000000' : '#ffffff';
}
