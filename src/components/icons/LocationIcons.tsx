// Custom minimal SVG icons for locations - Stripe-inspired design

interface IconProps {
  className?: string;
}

export const USFlagIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Minimal US flag - simplified stripes and star field */}
    <rect x="1" y="2" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="1" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="1" y="2" width="6" height="6" fill="currentColor" fillOpacity="0.15"/>
    <circle cx="4" cy="4.5" r="0.8" fill="currentColor"/>
  </svg>
);

export const CanadaIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Minimal maple leaf */}
    <path d="M8 2L7 5H5L7 7L6 10L8 9L10 10L9 7L11 5H9L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <line x1="8" y1="9" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const NorthAmericaIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Minimal continental outline */}
    <path d="M3 3C3 3 5 2 7 2C9 2 10 3 11 3C12 3 13 2 13 2L13 8C13 8 12 9 11 10C10 11 9 12 8 13C7 12 6 11 5 10C4 9 3 8 3 8L3 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

export const EuropeIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Minimal EU stars in circle */}
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="8" cy="3.5" r="0.7" fill="currentColor"/>
    <circle cx="11.5" cy="5.5" r="0.7" fill="currentColor"/>
    <circle cx="11.5" cy="10.5" r="0.7" fill="currentColor"/>
    <circle cx="8" cy="12.5" r="0.7" fill="currentColor"/>
    <circle cx="4.5" cy="10.5" r="0.7" fill="currentColor"/>
    <circle cx="4.5" cy="5.5" r="0.7" fill="currentColor"/>
  </svg>
);

export const UKIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Minimal Union Jack elements */}
    <rect x="1" y="2" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="1" y1="2" x2="15" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    <line x1="15" y1="2" x2="1" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
    <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const AsiaPacificIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Minimal regional symbol - stylized waves/mountain */}
    <path d="M2 10C3 8 4 7 6 7C7 7 8 8 8 8C8 8 9 7 10 7C12 7 13 8 14 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <circle cx="8" cy="4" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M4 13H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const GlobalIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Minimal globe with meridians */}
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <ellipse cx="8" cy="8" rx="2.5" ry="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 2C9.5 4 9.5 12 8 14" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);

export const MapPinIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Fallback minimal map pin */}
    <path d="M8 2C5.79 2 4 3.79 4 6C4 9 8 14 8 14C8 14 12 9 12 6C12 3.79 10.21 2 8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);
