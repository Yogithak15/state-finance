import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

const base: IconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const SdpIcon: React.FC<IconProps> = (props) => (
  <svg {...base} {...props}>
    <path d="M4 19V10" />
    <path d="M10 19V6" />
    <path d="M16 19V13" />
    <path d="M22 19V3" />
    <path d="M2 19h20" />
  </svg>
);

export const PriceWagesIcon: React.FC<IconProps> = (props) => (
  <svg {...base} {...props}>
    <path d="M3 12l8-8 9 1 1 9-8 8a2 2 0 0 1-2.8 0L3 14.8a2 2 0 0 1 0-2.8Z" />
    <circle cx="14" cy="9" r="1.6" />
  </svg>
);

export const BankingIcon: React.FC<IconProps> = (props) => (
  <svg {...base} {...props}>
    <path d="M3 10l9-6 9 6" />
    <path d="M4 10v9" />
    <path d="M9 10v9" />
    <path d="M15 10v9" />
    <path d="M20 10v9" />
    <path d="M2 19h20" />
  </svg>
);

export const FiscalIcon: React.FC<IconProps> = (props) => (
  <svg {...base} {...props}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M8 8h8" />
    <path d="M8 12h8" />
    <path d="M8 16h5" />
  </svg>
);

export const StateProfileIcon: React.FC<IconProps> = (props) => (
  <svg {...base} {...props}>
    <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.6" />
  </svg>
);

export const CompareStatesIcon: React.FC<IconProps> = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="9" width="7" height="12" rx="1.2" />
    <rect x="14" y="3" width="7" height="18" rx="1.2" />
    <path d="M3 5.5h2M18 21.5v-2" />
  </svg>
);

export const CATEGORY_ICONS: Record<string, React.FC<IconProps>> = {
  sdp: SdpIcon,
  'prices-wages': PriceWagesIcon,
  banking: BankingIcon,
  fiscal: FiscalIcon,
  'state-profile': StateProfileIcon,
  'compare-states': CompareStatesIcon,
};

export const LogoMark: React.FC<IconProps> = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 13l2.5 2.5L16 10" />
  </svg>
);

export const SunIcon: React.FC<IconProps> = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
  </svg>
);

export const MoonIcon: React.FC<IconProps> = (props) => (
  <svg {...base} {...props}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />
  </svg>
);

export const MenuIcon: React.FC<IconProps> = (props) => (
  <svg {...base} {...props}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = (props) => (
  <svg {...base} {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
