import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Globe, MapPin, Calendar, Users, Briefcase, Home, Pencil, ExternalLink } from "lucide-react";

interface BuyerCompanyOverviewCardProps {
  website?: string | null;
  hqCity?: string | null;
  hqState?: string | null;
  hqCountry?: string | null;
  foundedYear?: number | null;
  employeeCount?: number | null;
  employeeRange?: string | null;
  industryVertical?: string | null;
  numberOfLocations?: number | null;
  operatingLocations?: string[] | null;
  onEdit: () => void;
}

export const BuyerCompanyOverviewCard = ({
  website,
  hqCity,
  hqState,
  hqCountry,
  foundedYear,
  employeeCount,
  employeeRange,
  industryVertical,
  numberOfLocations,
  operatingLocations,
  onEdit,
}: BuyerCompanyOverviewCardProps) => {
  const headquarters = [hqCity, hqState, hqCountry].filter(Boolean).join(", ");
  const employees = employeeCount ? employeeCount.toLocaleString() : employeeRange || null;

  const DataItem = ({ icon: Icon, label, value, isLink = false, href }: {
    icon: React.ElementType;
    label: string;
    value?: string | number | null;
    isLink?: boolean;
    href?: string;
  }) => (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        {value ? (
          isLink && href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
            >
              {value}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          ) : (
            <p className="text-sm truncate">{value}</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground italic">—</p>
        )}
      </div>
    </div>
  );

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Building2 className="h-4 w-4" />
            Company Overview
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <DataItem
            icon={Globe}
            label="Website"
            value={website ? website.replace(/^https?:\/\//, "").replace(/\/$/, "") : null}
            isLink={!!website}
            href={website?.startsWith("http") ? website : `https://${website}`}
          />
          <DataItem
            icon={MapPin}
            label="Headquarters"
            value={headquarters || null}
          />
          <DataItem
            icon={Calendar}
            label="Founded"
            value={foundedYear}
          />
          <DataItem
            icon={Users}
            label="Employees"
            value={employees}
          />
          <DataItem
            icon={Briefcase}
            label="Industry"
            value={industryVertical}
          />
          <DataItem
            icon={Home}
            label="Locations"
            value={numberOfLocations || operatingLocations?.length ? 
              `${numberOfLocations || operatingLocations?.length} locations` : null}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default BuyerCompanyOverviewCard;