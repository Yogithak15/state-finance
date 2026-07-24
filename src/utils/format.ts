export const formatInr = (value: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;

// Compact Indian-scale format: Thousand (K) → Lakh (L) → Crore (Cr) → Lakh Crore (L Cr).
// GSDP/NSDP values run into the trillions, where plain comma-grouping is unreadable.
export const formatInrShort = (value: number): string => {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  const scale = (divisor: number, suffix: string) => {
    const scaled = abs / divisor;
    const rounded = scaled >= 100 ? Math.round(scaled) : Math.round(scaled * 100) / 100;
    return `${sign}₹${rounded}${suffix}`;
  };

  if (abs >= 1e12) return scale(1e12, ' L Cr');
  if (abs >= 1e7) return scale(1e7, ' Cr');
  if (abs >= 1e5) return scale(1e5, ' L');
  if (abs >= 1e3) return scale(1e3, ' K');
  return `${sign}₹${Math.round(abs)}`;
};
