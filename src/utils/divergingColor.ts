import { ThemeMode } from '../theme/ThemeContext';
import { DIVERGING_SCALE } from '../theme/chartColors';

const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

const toHex = (rgb: [number, number, number]) =>
  `#${rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;

export const divergingColor = (value: number, maxAbs: number, theme: ThemeMode = 'light'): string => {
  const { neutral, green, red } = DIVERGING_SCALE[theme];
  if (!Number.isFinite(value) || maxAbs <= 0) return toHex(neutral);
  const t = Math.max(-1, Math.min(1, value / maxAbs));
  return t >= 0 ? toHex(mix(neutral, green, t)) : toHex(mix(neutral, red, -t));
};

export const textColorForBg = (bgHex: string): string => {
  const n = parseInt(bgHex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#101828' : '#ffffff';
};
