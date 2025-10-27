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
import AcquisitionTypeBadge from "./AcquisitionTypeBadge";

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

interface ListingCardBadgesProps {
  location: string;
  categories?: string[];
  acquisitionType?: 'add_on' | 'platform' | string | null;
}

// Helper function to get location icon based on location string
const getLocationIcon = (location: string) => {
  const loc = location.toLowerCase();
  
  // US and US regions get US flag
  if (loc.includes('us') || loc === 'united states' || 
      loc.includes('northeast') || loc.includes('southeast') || 
      loc.includes('midwest') || loc.includes('southwest') || 
      loc.includes('western') || loc.includes('west coast') || 
      loc.includes('east coast')) {
    return <USFlagIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  
  if (loc.includes('canada')) return <CanadaIcon className="w-3.5 h-3.5 text-slate-500" />;
  if (loc.includes('north america')) return <NorthAmericaIcon className="w-3.5 h-3.5 text-slate-500" />;
  if (loc.includes('europe')) return <EuropeIcon className="w-3.5 h-3.5 text-slate-500" />;
  if (loc.includes('united kingdom') || loc === 'uk' || loc.includes('britain')) {
    return <UKIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (loc.includes('asia') || loc.includes('pacific')) {
    return <AsiaPacificIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (loc.includes('global') || loc.includes('international')) {
    return <GlobalIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  
  return <MapPinIcon className="w-3.5 h-3.5 text-slate-500" />;
};

// Helper function to get category icon based on category string
const getCategoryIcon = (category: string) => {
  const cat = category.toLowerCase();
  
  if (cat.includes('technology') || cat.includes('software')) {
    return <TechnologyIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('healthcare') || cat.includes('medical')) {
    return <HealthcareIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('manufacturing')) {
    return <ManufacturingIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('finance') || cat.includes('insurance')) {
    return <FinanceIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('retail') || cat.includes('e-commerce')) {
    return <RetailIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('real estate')) {
    return <RealEstateIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('food') || cat.includes('beverage')) {
    return <FoodBeverageIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('professional services')) {
    return <ProfessionalServicesIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('construction')) {
    return <ConstructionIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('transportation') || cat.includes('logistics')) {
    return <TransportationIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('education')) {
    return <EducationIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('hospitality') || cat.includes('tourism')) {
    return <HospitalityIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('energy') || cat.includes('utilities')) {
    return <EnergyIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('media') || cat.includes('entertainment')) {
    return <MediaIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('automotive')) {
    return <AutomotiveIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('agriculture')) {
    return <AgricultureIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('telecommunications')) {
    return <TelecommunicationsIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('consumer goods')) {
    return <ConsumerGoodsIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  if (cat.includes('business services')) {
    return <BusinessServicesIcon className="w-3.5 h-3.5 text-slate-500" />;
  }
  
  return <DefaultCategoryIcon className="w-3.5 h-3.5 text-slate-500" />;
};

const ListingCardBadges = ({ location, categories = [], acquisitionType }: ListingCardBadgesProps) => {
  const categoriesToShow = categories.slice(0, 2);
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Acquisition Type badge - FIRST (most strategic info) */}
      <AcquisitionTypeBadge type={acquisitionType} />
      
      {/* Category badges (up to 2) */}
      {categoriesToShow.map((cat, idx) => (
        <div
          key={`${cat}-${idx}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
        >
          {getCategoryIcon(cat)}
          <span className="text-[10px] font-medium text-slate-700 tracking-[0.02em]">
            {cat}
          </span>
        </div>
      ))}
      
      {/* Location badge */}
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
        {getLocationIcon(location)}
        <span className="text-[10px] font-medium text-slate-700 tracking-[0.02em]">
          {location}
        </span>
      </div>
    </div>
  );
};

export default ListingCardBadges;
