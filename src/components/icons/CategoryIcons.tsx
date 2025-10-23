// Custom minimal SVG icons for business categories - Stripe-inspired design

interface IconProps {
  className?: string;
}

export const TechnologyIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Code brackets */}
    <path d="M5 4L2 8L5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11 4L14 8L11 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="9" y1="3" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const HealthcareIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Medical cross */}
    <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="6" y="2" width="4" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <rect x="6" y="9" width="4" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <rect x="2" y="6" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <rect x="9" y="6" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);

export const ManufacturingIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Gear */}
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="8" cy="8" r="1" fill="currentColor"/>
    <line x1="8" y1="2" x2="8" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="8" y1="12" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="2" y1="8" x2="4" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="12" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const FinanceIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Graph line trending up */}
    <polyline points="2,12 5,8 8,10 11,5 14,7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <polyline points="11,5 14,5 14,7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
  </svg>
);

export const RetailIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Shopping bag */}
    <rect x="3" y="5" width="10" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M6 5V4C6 2.89543 6.89543 2 8 2C9.10457 2 10 2.89543 10 4V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const RealEstateIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* House */}
    <path d="M2 7L8 2L14 7V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V7Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M6 14V10H10V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const FoodBeverageIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Coffee cup */}
    <path d="M3 5H11C11 5 11 7 11 9C11 11 9.5 13 7 13C4.5 13 3 11 3 9C3 7 3 5 3 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M11 7H12C12.5523 7 13 7.44772 13 8V8C13 8.55228 12.5523 9 12 9H11" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5 3L6 5M8 3L8 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const ProfessionalServicesIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Briefcase */}
    <rect x="2" y="5" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M6 5V4C6 3.44772 6.44772 3 7 3H9C9.55228 3 10 3.44772 10 4V5" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="2" y1="9" x2="14" y2="9" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const ConstructionIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Hard hat / building */}
    <path d="M2 10L2 13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M3 10C3 7 5 5 8 5C11 5 13 7 13 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <line x1="8" y1="2" x2="8" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const TransportationIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Truck */}
    <rect x="2" y="5" width="8" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M10 7H12L14 9V11H10V7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    <circle cx="5" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="12" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);

export const EducationIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Graduation cap */}
    <path d="M2 6L8 3L14 6L8 9L2 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M4 7.5V10.5C4 10.5 5.5 12 8 12C10.5 12 12 10.5 12 10.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const HospitalityIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Bed / hotel */}
    <rect x="2" y="6" width="12" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="2" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const EnergyIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Lightning bolt */}
    <path d="M9 2L4 9H8L7 14L12 7H8L9 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

export const MediaIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Camera / media */}
    <rect x="2" y="4" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="8" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M5 4L6 2H10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const AutomotiveIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Car */}
    <path d="M3 9L4 6H12L13 9M3 9V12H4M3 9H13M13 9V12H12M4 12H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="5" cy="9" r="0.5" fill="currentColor"/>
    <circle cx="11" cy="9" r="0.5" fill="currentColor"/>
  </svg>
);

export const AgricultureIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Plant / sprout */}
    <path d="M8 14V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 8C8 8 6 6 4 6C4 6 4 8 6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M8 8C8 8 10 6 12 6C12 6 12 8 10 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M8 10C8 10 10 9 11 10C11 10 10 11 9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

export const TelecommunicationsIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Signal waves */}
    <path d="M8 8V8.01M5 5C6.5 6.5 9.5 6.5 11 5M3 3C5.5 5.5 10.5 5.5 13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="8" y1="10" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const ConsumerGoodsIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Package box */}
    <path d="M2 5L8 2L14 5V11L8 14L2 11V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M2 5L8 8M8 8L14 5M8 8V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const BusinessServicesIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Building */}
    <rect x="3" y="2" width="10" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="6" y1="5" x2="6" y2="5.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="10" y1="5" x2="10" y2="5.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="6" y1="8" x2="6" y2="8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="10" y1="8" x2="10" y2="8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="7" y="11" width="2" height="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);

// Default fallback icon
export const DefaultCategoryIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Generic building */}
    <rect x="4" y="3" width="8" height="11" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="7" y1="6" x2="7" y2="6.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="9" y1="6" x2="9" y2="6.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="7" y1="9" x2="7" y2="9.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="9" y1="9" x2="9" y2="9.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
