import {
  USFlagIcon,
  CanadaIcon,
  NorthAmericaIcon,
  EuropeIcon,
  UKIcon,
  AsiaPacificIcon,
  GlobalIcon,
  MapPinIcon,
} from "@/components/icons/LocationIcons";

import {
  TechnologyIcon,
  HealthcareIcon,
  ManufacturingIcon,
  FinanceIcon,
  RetailIcon,
  RealEstateIcon,
  FoodBeverageIcon,
  ProfessionalServicesIcon,
  ConstructionIcon,
  TransportationIcon,
  EducationIcon,
  HospitalityIcon,
  EnergyIcon,
  MediaIcon,
  AutomotiveIcon,
  AgricultureIcon,
  TelecommunicationsIcon,
  ConsumerGoodsIcon,
  BusinessServicesIcon,
  DefaultCategoryIcon,
} from "@/components/icons/CategoryIcons";
import { toStandardCategory, toStandardLocation } from "@/lib/standardization";

interface CategoryLocationBadgesProps {
  category?: string;
  location?: string;
  variant?: "default" | "text-only" | "inline";
  className?: string;
}

// Helper function to get location icon based on location string
const getLocationIcon = (location: string) => {
  const loc = location.toLowerCase();
  const iconClass = "w-4 h-4 text-slate-500";
  
  // US and US regions get US flag
  if (loc.includes('us') || loc === 'united states' || 
      loc.includes('northeast') || loc.includes('southeast') || 
      loc.includes('midwest') || loc.includes('southwest') || 
      loc.includes('western') || loc.includes('west coast') || 
      loc.includes('east coast')) {
    return <USFlagIcon className={iconClass} />;
  }
  
  if (loc.includes('canada')) return <CanadaIcon className={iconClass} />;
  if (loc.includes('north america')) return <NorthAmericaIcon className={iconClass} />;
  if (loc.includes('europe')) return <EuropeIcon className={iconClass} />;
  if (loc.includes('united kingdom') || loc === 'uk' || loc.includes('britain')) {
    return <UKIcon className={iconClass} />;
  }
  if (loc.includes('asia') || loc.includes('pacific')) {
    return <AsiaPacificIcon className={iconClass} />;
  }
  if (loc.includes('global') || loc.includes('international')) {
    return <GlobalIcon className={iconClass} />;
  }
  
  return <MapPinIcon className={iconClass} />;
};

// Helper function to get category icon based on category string
const getCategoryIcon = (category: string) => {
  const cat = category.toLowerCase();
  const iconClass = "w-4 h-4 text-slate-500";
  
  if (cat.includes('technology') || cat.includes('software')) {
    return <TechnologyIcon className={iconClass} />;
  }
  if (cat.includes('healthcare') || cat.includes('medical')) {
    return <HealthcareIcon className={iconClass} />;
  }
  if (cat.includes('manufacturing')) {
    return <ManufacturingIcon className={iconClass} />;
  }
  if (cat.includes('finance') || cat.includes('insurance')) {
    return <FinanceIcon className={iconClass} />;
  }
  if (cat.includes('retail') || cat.includes('e-commerce')) {
    return <RetailIcon className={iconClass} />;
  }
  if (cat.includes('real estate')) {
    return <RealEstateIcon className={iconClass} />;
  }
  if (cat.includes('food') || cat.includes('beverage')) {
    return <FoodBeverageIcon className={iconClass} />;
  }
  if (cat.includes('professional services')) {
    return <ProfessionalServicesIcon className={iconClass} />;
  }
  if (cat.includes('construction')) {
    return <ConstructionIcon className={iconClass} />;
  }
  if (cat.includes('transportation') || cat.includes('logistics')) {
    return <TransportationIcon className={iconClass} />;
  }
  if (cat.includes('education')) {
    return <EducationIcon className={iconClass} />;
  }
  if (cat.includes('hospitality') || cat.includes('tourism')) {
    return <HospitalityIcon className={iconClass} />;
  }
  if (cat.includes('energy') || cat.includes('utilities')) {
    return <EnergyIcon className={iconClass} />;
  }
  if (cat.includes('media') || cat.includes('entertainment')) {
    return <MediaIcon className={iconClass} />;
  }
  if (cat.includes('automotive')) {
    return <AutomotiveIcon className={iconClass} />;
  }
  if (cat.includes('agriculture')) {
    return <AgricultureIcon className={iconClass} />;
  }
  if (cat.includes('telecommunications')) {
    return <TelecommunicationsIcon className={iconClass} />;
  }
  if (cat.includes('consumer goods')) {
    return <ConsumerGoodsIcon className={iconClass} />;
  }
  if (cat.includes('business services')) {
    return <BusinessServicesIcon className={iconClass} />;
  }
  
  return <DefaultCategoryIcon className={iconClass} />;
};

export const CategoryLocationBadges = ({ 
  category, 
  location, 
  variant = "default",
  className = "" 
}: CategoryLocationBadgesProps) => {
  // Standardize the values
  const standardCategory = category ? toStandardCategory(category) : undefined;
  const standardLocation = location ? toStandardLocation(location) : undefined;

  if (variant === "text-only") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {standardCategory && (
          <span className="text-xs font-medium text-gray-600 tracking-wide">
            {standardCategory}
          </span>
        )}
        {standardCategory && standardLocation && (
          <span className="text-gray-300 text-xs">•</span>
        )}
        {standardLocation && (
          <span className="text-xs font-medium text-gray-600 tracking-wide">
            {standardLocation}
          </span>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-2 text-sm text-slate-500 ${className}`}>
        {standardCategory && (
          <span>{standardCategory}</span>
        )}
        {standardLocation && (
          <>
            <span>•</span>
            <div className="flex items-center gap-1">
              {getLocationIcon(standardLocation)}
              <span>{standardLocation}</span>
            </div>
          </>
        )}
      </div>
    );
  }

  // Default variant - badge style
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {standardCategory && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          {getCategoryIcon(standardCategory)}
          <span className="text-[11px] font-medium text-slate-700 tracking-[0.02em]">
            {standardCategory}
          </span>
        </div>
      )}
      
      {standardLocation && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          {getLocationIcon(standardLocation)}
          <span className="text-[11px] font-medium text-slate-700 tracking-[0.02em]">
            {standardLocation}
          </span>
        </div>
      )}
    </div>
  );
};
