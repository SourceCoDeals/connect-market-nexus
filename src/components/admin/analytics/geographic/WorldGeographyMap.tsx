import { useGeographicAnalytics } from "@/hooks/useGeographicAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { cn } from "@/lib/utils";
import { Globe, MapPin, Clock } from "lucide-react";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Country name to ISO mapping for choropleth
const countryToISO: Record<string, string> = {
  'United States': 'USA',
  'Canada': 'CAN',
  'United Kingdom': 'GBR',
  'Germany': 'DEU',
  'France': 'FRA',
  'Australia': 'AUS',
  'India': 'IND',
  'Brazil': 'BRA',
  'Mexico': 'MEX',
  'Japan': 'JPN',
  'China': 'CHN',
  'Spain': 'ESP',
  'Italy': 'ITA',
  'Netherlands': 'NLD',
  // Add more as needed
};

interface WorldGeographyMapProps {
  timeRangeDays: number;
}

export function WorldGeographyMap({ timeRangeDays }: WorldGeographyMapProps) {
  const { data, isLoading, error } = useGeographicAnalytics(timeRangeDays);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load geographic data</p>
      </div>
    );
  }

  // Create a lookup for country session counts
  const countryData = new Map(
    data.countryBreakdown.map(c => [c.country, c])
  );

  const getCountryColor = (countryName: string) => {
    const countryInfo = data.countryBreakdown.find(c => {
      // Try to match by name
      return countryName.toLowerCase().includes(c.country.toLowerCase()) ||
             c.country.toLowerCase().includes(countryName.toLowerCase());
    });
    
    if (!countryInfo) return 'hsl(var(--muted))';
    
    // Color intensity based on session count
    const maxSessions = Math.max(...data.countryBreakdown.map(c => c.sessions), 1);
    const intensity = countryInfo.sessions / maxSessions;
    
    if (intensity > 0.7) return 'hsl(var(--coral-500))';
    if (intensity > 0.4) return 'hsl(var(--coral-400))';
    if (intensity > 0.2) return 'hsl(var(--coral-300))';
    if (intensity > 0) return 'hsl(var(--coral-200))';
    return 'hsl(var(--muted))';
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          icon={<Globe className="h-4 w-4" />}
          label="Countries" 
          value={data.totalCountries.toString()} 
        />
        <StatCard 
          icon={<MapPin className="h-4 w-4" />}
          label="Cities" 
          value={data.totalCities.toString()} 
        />
        <StatCard 
          icon={<Globe className="h-4 w-4" />}
          label="Top Country" 
          value={data.topCountry} 
        />
        <StatCard 
          icon={<Clock className="h-4 w-4" />}
          label="Domestic %" 
          value={`${data.domesticPercentage.toFixed(1)}%`} 
        />
      </div>

      {/* World Map */}
      <div className="rounded-2xl bg-card border border-border/50 p-6">
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Session Geography
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Where your users are browsing from
          </p>
        </div>

        <div className="h-[300px] w-full">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: 130,
              center: [0, 30],
            }}
            style={{ width: "100%", height: "100%" }}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryName = geo.properties.name;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getCountryColor(countryName)}
                      stroke="hsl(var(--border))"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { 
                          outline: "none", 
                          fill: "hsl(var(--coral-500))",
                          cursor: "pointer"
                        },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        </div>

        {/* Color Legend */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <span className="text-xs text-muted-foreground">Less</span>
          <div className="flex gap-1">
            <div className="h-3 w-6 rounded bg-coral-200" />
            <div className="h-3 w-6 rounded bg-coral-300" />
            <div className="h-3 w-6 rounded bg-coral-400" />
            <div className="h-3 w-6 rounded bg-coral-500" />
          </div>
          <span className="text-xs text-muted-foreground">More Sessions</span>
        </div>
      </div>

      {/* Country Breakdown + City List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CountryBreakdownTable data={data.countryBreakdown.slice(0, 10)} />
        <div className="space-y-6">
          <CityBreakdownList data={data.cityBreakdown.slice(0, 8)} />
          <TimezoneDistribution data={data.timezoneDistribution.slice(0, 5)} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 p-5">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em]">
          {label}
        </p>
      </div>
      <p className="text-2xl font-light tracking-tight text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}

function CountryBreakdownTable({ data }: { data: Array<{ country: string; sessions: number; uniqueUsers: number; avgDuration: number; percentage: number }> }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4">
        Top Countries
      </p>
      <div className="space-y-2">
        {data.map((country, i) => (
          <div key={country.country} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground w-5">{i + 1}</span>
              <span className="text-sm font-medium">{country.country}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="tabular-nums">{country.sessions} sessions</span>
              <span className="text-muted-foreground text-xs w-12 text-right">
                {country.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CityBreakdownList({ data }: { data: Array<{ city: string; country: string; sessions: number }> }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4">
        Top Cities
      </p>
      <div className="space-y-2">
        {data.map((city) => (
          <div key={`${city.city}-${city.country}`} className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">{city.city}</span>
              <span className="text-xs text-muted-foreground ml-2">{city.country}</span>
            </div>
            <span className="text-sm tabular-nums">{city.sessions}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimezoneDistribution({ data }: { data: Array<{ timezone: string; count: number; percentage: number }> }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4">
        Timezone Distribution
      </p>
      <div className="space-y-2">
        {data.map((tz) => (
          <div key={tz.timezone} className="flex items-center justify-between">
            <span className="text-xs truncate max-w-[160px]" title={tz.timezone}>
              {tz.timezone.replace('_', ' ')}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {tz.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[400px] rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[300px] rounded-2xl" />
        <Skeleton className="h-[300px] rounded-2xl" />
      </div>
    </div>
  );
}
