// Custom minimal SVG icons for business categories - Clean, filled style

interface IconProps {
  className?: string;
}

export const TechnologyIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 7L4 12L8 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 7L20 12L16 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const HealthcareIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="5" width="4" height="14" fill="currentColor"/>
    <rect x="5" y="10" width="14" height="4" fill="currentColor"/>
  </svg>
);

export const ManufacturingIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.3"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
    <rect x="11" y="4" width="2" height="4" fill="currentColor"/>
    <rect x="11" y="16" width="2" height="4" fill="currentColor"/>
    <rect x="4" y="11" width="4" height="2" fill="currentColor"/>
    <rect x="16" y="11" width="4" height="2" fill="currentColor"/>
  </svg>
);

export const FinanceIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 18L8 14L12 16L16 10L20 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 10L20 10L20 12" fill="currentColor"/>
  </svg>
);

export const RetailIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 8V7C6 5.34315 7.34315 4 9 4H15C16.6569 4 18 5.34315 18 7V8" stroke="currentColor" strokeWidth="2"/>
    <rect x="4" y="8" width="16" height="12" rx="1" fill="currentColor" opacity="0.3"/>
  </svg>
);

export const RealEstateIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 10L12 4L20 10V19H4V10Z" fill="currentColor" opacity="0.3"/>
    <rect x="10" y="14" width="4" height="5" fill="currentColor"/>
  </svg>
);

export const FoodBeverageIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 8H14V12C14 14.2091 12.2091 16 10 16C7.79086 16 6 14.2091 6 12V8Z" fill="currentColor" opacity="0.3"/>
    <path d="M14 10H16C16.5523 10 17 10.4477 17 11C17 11.5523 16.5523 12 16 12H14" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="8" y1="5" x2="9" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const ProfessionalServicesIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="8" width="16" height="10" rx="1" fill="currentColor" opacity="0.3"/>
    <path d="M9 8V7C9 6.44772 9.44772 6 10 6H14C14.5523 6 15 6.44772 15 7V8" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="4" y1="13" x2="20" y2="13" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const ConstructionIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 14C5 10 7.5 8 12 8C16.5 8 19 10 19 14" fill="currentColor" opacity="0.3"/>
    <rect x="4" y="14" width="16" height="5" fill="currentColor" opacity="0.3"/>
    <line x1="12" y1="5" x2="12" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const TransportationIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="9" width="11" height="7" rx="0.5" fill="currentColor" opacity="0.3"/>
    <path d="M15 11H18L20 13V16H15V11Z" fill="currentColor" opacity="0.3"/>
    <circle cx="8" cy="16" r="1.5" fill="currentColor"/>
    <circle cx="17" cy="16" r="1.5" fill="currentColor"/>
  </svg>
);

export const EducationIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 9L12 5L21 9L12 13L3 9Z" fill="currentColor" opacity="0.3"/>
    <path d="M6 11V15C6 15 8 17 12 17C16 17 18 15 18 15V11" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const HospitalityIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="10" width="16" height="8" fill="currentColor" opacity="0.3"/>
    <circle cx="8" cy="7" r="2" fill="currentColor" opacity="0.5"/>
    <line x1="4" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const EnergyIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 4L7 13H11L10 20L16 11H12L13 4Z" fill="currentColor"/>
  </svg>
);

export const MediaIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="7" width="16" height="12" rx="1" fill="currentColor" opacity="0.3"/>
    <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M8 7L10 5H14L16 7" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const AutomotiveIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 13L7 9H17L19 13H5Z" fill="currentColor" opacity="0.3"/>
    <rect x="5" y="13" width="14" height="4" fill="currentColor" opacity="0.3"/>
    <circle cx="8" cy="13" r="1" fill="currentColor"/>
    <circle cx="16" cy="13" r="1" fill="currentColor"/>
  </svg>
);

export const AgricultureIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="12" y1="20" x2="12" y2="12" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 12C12 12 10 10 8 10C8 10 8 12 10 13" fill="currentColor" opacity="0.5"/>
    <path d="M12 12C12 12 14 10 16 10C16 10 16 12 14 13" fill="currentColor" opacity="0.5"/>
    <path d="M12 14C12 14 14 13 15 14C15 14 14 15 13 15" fill="currentColor" opacity="0.5"/>
  </svg>
);

export const TelecommunicationsIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    <path d="M8 8C10 10 14 10 16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M6 5C9 8 15 8 18 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="12" y1="14" x2="12" y2="19" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

export const ConsumerGoodsIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 9L12 5L20 9V16L12 20L4 16V9Z" fill="currentColor" opacity="0.3"/>
    <line x1="12" y1="12" x2="12" y2="20" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="4" y1="9" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="20" y1="9" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const BusinessServicesIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="5" width="12" height="14" rx="0.5" fill="currentColor" opacity="0.3"/>
    <rect x="9" y="8" width="2" height="2" fill="currentColor"/>
    <rect x="13" y="8" width="2" height="2" fill="currentColor"/>
    <rect x="9" y="12" width="2" height="2" fill="currentColor"/>
    <rect x="13" y="12" width="2" height="2" fill="currentColor"/>
    <rect x="10" y="16" width="4" height="3" fill="currentColor" opacity="0.7"/>
  </svg>
);

export const DefaultCategoryIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="6" width="10" height="13" rx="0.5" fill="currentColor" opacity="0.3"/>
    <rect x="10" y="9" width="2" height="2" fill="currentColor"/>
    <rect x="12" y="9" width="2" height="2" fill="currentColor"/>
    <rect x="10" y="13" width="2" height="2" fill="currentColor"/>
    <rect x="12" y="13" width="2" height="2" fill="currentColor"/>
  </svg>
);
