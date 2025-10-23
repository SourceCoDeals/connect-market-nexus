
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
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <CategoryIcon className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
          <span className="text-[10px] font-medium text-slate-700 tracking-[0.02em]">
            {primaryCategory}
          </span>
        </div>
      )}
      
      {/* Location badge */}
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
        <MapPin className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
        <span className="text-[10px] font-medium text-slate-700 tracking-[0.02em]">
          {location}
        </span>
      </div>
    </div>
  );
};

export default ListingCardBadges;
