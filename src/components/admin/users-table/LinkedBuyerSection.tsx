import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Globe,
  Briefcase,
  DollarSign,
  MapPin,
  Wrench,
} from 'lucide-react';
import {
  useLinkedBuyerPlatforms,
  type LinkedBuyerRecord,
} from '@/hooks/admin/use-linked-buyer-platforms';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface LinkedBuyerSectionProps {
  buyerId: string;
  mandateBlurb?: string | null;
}

const formatEbitda = (value: number | null): string => {
  if (!value) return '—';
  if (value >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

const Chips = ({ items }: { items: string[] | null | undefined }) => {
  if (!items || items.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">
          {item}
        </span>
      ))}
    </div>
  );
};

const PlatformCard = ({ platform }: { platform: LinkedBuyerRecord }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-lg p-4 bg-background space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/admin/remarketing/buyers/${platform.id}`}
            className="font-medium text-foreground hover:text-primary inline-flex items-center gap-1.5"
          >
            <Building2 className="h-4 w-4" />
            {platform.company_name}
            <ExternalLink className="h-3 w-3" />
          </Link>
          {platform.industry_vertical && (
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {platform.industry_vertical}
            </div>
          )}
        </div>
        {platform.company_website && (
          <a
            href={
              platform.company_website.startsWith('http')
                ? platform.company_website
                : `https://${platform.company_website}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
          >
            <Globe className="h-3 w-3" />
            Website
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <DollarSign className="h-3 w-3" /> EBITDA Floor
          </div>
          <div className="font-medium">{formatEbitda(platform.target_ebitda_min)}+</div>
        </div>
        {platform.revenue_model && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Revenue Model</div>
            <div className="font-medium text-xs">{platform.revenue_model}</div>
          </div>
        )}
      </div>

      <div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
          <MapPin className="h-3 w-3" /> Geographies
        </div>
        <Chips items={platform.target_geographies} />
      </div>

      <div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
          <Wrench className="h-3 w-3" /> Services
        </div>
        <Chips items={platform.target_services} />
      </div>

      {platform.thesis_summary && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {open ? 'Hide' : 'Show'} full criteria
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <p className="text-xs leading-relaxed text-foreground bg-muted/40 rounded p-3 whitespace-pre-wrap">
              {platform.thesis_summary}
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export const LinkedBuyerSection = ({ buyerId, mandateBlurb }: LinkedBuyerSectionProps) => {
  const { data, isLoading, error } = useLinkedBuyerPlatforms(buyerId);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground pl-6">Loading linked buyer profile…</div>;
  }
  if (error || !data?.parent) {
    return null;
  }

  const { parent, platforms } = data;

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-foreground flex items-center gap-2">
        <Building2 className="h-4 w-4" />
        Linked Buyer Profile
      </h4>
      <div className="pl-6 space-y-4">
        {mandateBlurb && (
          <div className="text-sm leading-relaxed bg-muted/40 border border-border rounded-lg p-3">
            {mandateBlurb}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
          <div className="min-w-0">
            <Link
              to={`/admin/remarketing/buyers/${parent.id}`}
              className="font-medium text-foreground hover:text-primary inline-flex items-center gap-1.5"
            >
              {parent.company_name}
              <ExternalLink className="h-3 w-3" />
            </Link>
            <div className="text-xs text-muted-foreground capitalize">
              {parent.buyer_type?.replace(/_/g, ' ') || 'Buyer'}
              {platforms.length > 0 &&
                ` · ${platforms.length} platform${platforms.length === 1 ? '' : 's'}`}
            </div>
          </div>
        </div>

        {platforms.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">
            No platform companies linked to this buyer yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {platforms.map((p) => (
              <PlatformCard key={p.id} platform={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
