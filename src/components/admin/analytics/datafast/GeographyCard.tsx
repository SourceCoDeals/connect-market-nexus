import { useState, useMemo } from "react";
import { AnalyticsCard, SortToggle } from "./AnalyticsCard";
import { AnalyticsTooltip } from "./AnalyticsTooltip";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { cn } from "@/lib/utils";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface GeographyCardProps {
  countries: Array<{ name: string; code: string; visitors: number; connections: number }>;
  regions: Array<{ name: string; country: string; visitors: number; connections: number }>;
  cities: Array<{ name: string; country: string; visitors: number; connections: number }>;
}

// Map of country names to ISO codes for flag lookup
const COUNTRY_FLAGS: Record<string, string> = {
  'United States': '🇺🇸',
  'United Kingdom': '🇬🇧',
  'Canada': '🇨🇦',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Australia': '🇦🇺',
  'Netherlands': '🇳🇱',
  'The Netherlands': '🇳🇱',
  'Spain': '🇪🇸',
  'Italy': '🇮🇹',
  'Brazil': '🇧🇷',
  'India': '🇮🇳',
  'Japan': '🇯🇵',
  'Mexico': '🇲🇽',
  'Singapore': '🇸🇬',
  'Switzerland': '🇨🇭',
  'Sweden': '🇸🇪',
  'Norway': '🇳🇴',
  'Denmark': '🇩🇰',
  'Finland': '🇫🇮',
  'Ireland': '🇮🇪',
  'Belgium': '🇧🇪',
  'Austria': '🇦🇹',
  'Poland': '🇵🇱',
  'Portugal': '🇵🇹',
  'South Korea': '🇰🇷',
  'Unknown': '🌍',
};

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] || '🌍';
}

export function GeographyCard({ countries, regions, cities }: GeographyCardProps) {
  const [sortBy, setSortBy] = useState<'visitors' | 'connections'>('visitors');
  
  const tabs = [
    { id: 'map', label: 'Map' },
    { id: 'country', label: 'Country' },
    { id: 'region', label: 'Region' },
    { id: 'city', label: 'City' },
  ];

  const sortedCountries = [...countries].sort((a, b) => 
    sortBy === 'visitors' ? b.visitors - a.visitors : b.connections - a.connections
  );
  
  const sortedCities = [...cities].sort((a, b) => 
    sortBy === 'visitors' ? b.visitors - a.visitors : b.connections - a.connections
  );

  const maxVisitors = Math.max(...countries.map(c => c.visitors), 1);
  
  const countryVisitorMap = useMemo(() => {
    const map: Record<string, number> = {};
    countries.forEach(c => {
      map[c.name] = c.visitors;
    });
    return map;
  }, [countries]);

  const getCountryColor = (countryName: string) => {
    const visitors = countryVisitorMap[countryName] || 0;
    if (visitors === 0) return 'hsl(220 15% 95%)';
    const intensity = Math.min(visitors / maxVisitors, 1);
    // Coral gradient: from light peach to deep coral
    const lightness = 95 - (intensity * 40);
    return `hsl(12 95% ${lightness}%)`;
  };

  return (
    <AnalyticsCard
      tabs={tabs}
      defaultTab="country"
      rightAction={<SortToggle value={sortBy} onChange={setSortBy} />}
    >
      {(activeTab) => (
        <div>
          {activeTab === 'map' && (
            <div className="h-[240px] -mx-2">
              <ComposableMap
                projectionConfig={{
                  rotate: [-10, 0, 0],
                  scale: 130
                }}
                style={{ width: '100%', height: '100%' }}
              >
                <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const countryName = geo.properties.name;
                      const visitors = countryVisitorMap[countryName] || 0;
                      
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={getCountryColor(countryName)}
                          stroke="hsl(220 15% 90%)"
                          strokeWidth={0.5}
                          style={{
                            default: { outline: 'none' },
                            hover: { outline: 'none', fill: 'hsl(12 95% 70%)' },
                            pressed: { outline: 'none' },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ComposableMap>
            </div>
          )}
          
          {activeTab === 'country' && (
            <div className="space-y-1">
              {sortedCountries.slice(0, 8).map((country) => (
                <AnalyticsTooltip
                  key={country.name}
                  title={country.name}
                  rows={[
                    { label: 'Visitors', value: country.visitors.toLocaleString() },
                    { label: 'Connections', value: country.connections },
                    { label: 'Conv. Rate', value: `${country.visitors > 0 ? ((country.connections / country.visitors) * 100).toFixed(1) : 0}%`, highlight: true },
                  ]}
                >
                  <div className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{getFlag(country.name)}</span>
                      <span className="text-sm">{country.name}</span>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {country[sortBy].toLocaleString()}
                    </span>
                  </div>
                </AnalyticsTooltip>
              ))}
              {countries.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No country data</div>
              )}
            </div>
          )}
          
          {activeTab === 'region' && (
            <div className="space-y-1">
              {regions.slice(0, 8).map((region, i) => (
                <div 
                  key={`${region.name}-${i}`}
                  className="flex items-center justify-between py-1.5 hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{getFlag(region.country)}</span>
                    <span className="text-sm">{region.name}</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {region[sortBy].toLocaleString()}
                  </span>
                </div>
              ))}
              {regions.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No region data</div>
              )}
            </div>
          )}
          
          {activeTab === 'city' && (
            <div className="space-y-1">
              {sortedCities.slice(0, 8).map((city, i) => (
                <AnalyticsTooltip
                  key={`${city.name}-${i}`}
                  title={city.name}
                  rows={[
                    { label: 'Country', value: city.country },
                    { label: 'Visitors', value: city.visitors.toLocaleString() },
                    { label: 'Connections', value: city.connections },
                  ]}
                >
                  <div className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{getFlag(city.country)}</span>
                      <span className="text-sm">{city.name}</span>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {city[sortBy].toLocaleString()}
                    </span>
                  </div>
                </AnalyticsTooltip>
              ))}
              {cities.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No city data</div>
              )}
            </div>
          )}
        </div>
      )}
    </AnalyticsCard>
  );
}
