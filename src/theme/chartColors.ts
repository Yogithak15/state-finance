import { ThemeMode } from './ThemeContext';

export interface ChartPalette {
  grid: string;
  axisText: string;
  tooltipBg: string;
  tooltipBorder: string;
  ink: string;
  surface: string;
  muted: string;
  accent: string;
  accentDark: string;
  // Validated 8-slot categorical palette, fixed order (see dataviz skill palette.md).
  categorical: string[];
}

export const CHART_COLORS: Record<ThemeMode, ChartPalette> = {
  light: {
    grid: '#e5e9f2',
    axisText: '#64748b',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e5e9f2',
    ink: '#101828',
    surface: '#fcfcfb',
    muted: '#94a3b8',
    accent: '#4f7cff',
    accentDark: '#0d366b',
    categorical: ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'],
  },
  dark: {
    // Same navy used for the sidebar (--color-sidebar-bg / -active), not a
    // generic near-black surface.
    grid: '#2a3a5c',
    axisText: '#94a3b8',
    tooltipBg: '#1a2740',
    tooltipBorder: '#2a3a5c',
    ink: '#f1f5f9',
    surface: '#0f172a',
    muted: '#94a3b8',
    accent: '#6f92ff',
    accentDark: '#184f95',
    categorical: ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926'],
  },
};

// Sequential green ramp used by rankColor and the Real vs Nominal chart —
// near-black green at the dark end, light mint at the light end. The dark
// theme's "dark" end can't reuse the light theme's near-black value — that
// value only has contrast against a white surface, and disappears against
// the navy chart background — so it gets its own lighter, still-dark green.
export const RANK_GRADIENT: Record<ThemeMode, { dark: string; light: string }> = {
  light: { dark: '#0b2e1d', light: '#bdf0d4' },
  dark: { dark: '#2f9e6f', light: '#a8f0c6' },
};

// Diverging green↔red scale for growth-shock heatmaps — neutral midpoint is
// the chart surface itself (the same navy as the sidebar) so a near-zero
// cell reads as "blank" in both modes.
export const DIVERGING_SCALE: Record<ThemeMode, { neutral: [number, number, number]; green: [number, number, number]; red: [number, number, number] }> = {
  light: {
    neutral: [252, 252, 251],
    green: [15, 138, 95],
    red: [208, 59, 59],
  },
  dark: {
    neutral: [15, 23, 42],
    green: [25, 158, 112],
    red: [230, 103, 103],
  },
};

