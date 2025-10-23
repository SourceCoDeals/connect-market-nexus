
import { MapPin, TrendingUp, Building2, Package, Wrench, Users, Briefcase } from "lucide-react";

interface ListingCardBadgesProps {
  location: string;
  categories?: string[];
}

// Icon mapping for categories - Stripe-inspired
const CATEGORY_ICONS: Record<string, any> = {
  'Technology & Software': TrendingUp,
  'Healthcare & Medical': Package,
  'Manufacturing': Wrench,
  'Professional Services': Building2,
  'Business Services': Briefcase,
  'Default': Building2,
};

const ListingCardBadges = ({ location, categories = [] }: ListingCardBadgesProps) => {
  const primaryCategory = categories[0];
  const CategoryIcon = primaryCategory ? (CATEGORY_ICONS[primaryCategory] || CATEGORY_ICONS['Default']) : null;
  
  return (
    <div className="flex items-center gap-2">
      {/* Category badge */}
      {primaryCategory && CategoryIcon && (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200/60 shadow-sm">
          <CategoryIcon className="w-3 h-3 text-slate-500" strokeWidth={2} />
          <span className="text-[10px] font-medium text-slate-700 tracking-tight">
            {primaryCategory}
          </span>
        </div>
      )}
      
      {/* Location badge */}
      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200/60 shadow-sm">
        <MapPin className="w-3 h-3 text-slate-500" strokeWidth={2} />
        <span className="text-[10px] font-medium text-slate-700 tracking-tight">
          {location}
        </span>
      </div>
    </div>
  );
};

export default ListingCardBadges;
