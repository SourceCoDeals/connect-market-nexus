import { useState, useMemo } from "react";
import { AnalyticsCard, SortToggle, SortValue } from "./AnalyticsCard";
import { AnalyticsTooltip } from "./AnalyticsTooltip";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { cn } from "@/lib/utils";
import { ProportionalBar } from "./ProportionalBar";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface GeographyCardProps {
  countries: Array<{ name: string; code: string; visitors: number; signups: number; connections: number }>;
  regions: Array<{ name: string; country: string; visitors: number; signups: number; connections: number }>;
  cities: Array<{ name: string; country: string; visitors: number; signups: number; connections: number }>;
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
  'Hungary': '🇭🇺',
  'Czech Republic': '🇨🇿',
  'Unknown': '🌍',
};

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] || '🌍';
}

export function GeographyCard({ countries, regions, cities }: GeographyCardProps) {
  const [sortBy, setSortBy] = useState<SortValue>('visitors');
  
  const tabs = [
    { id: 'map', label: 'Map' },
    { id: 'country', label: 'Country' },
    { id: 'region', label: 'Region' },
    { id: 'city', label: 'City' },
  ];

  // Get sort value for any item
  const getSortValue = (item: { visitors?: number; signups?: number; connections?: number }) => {
    if (sortBy === 'visitors') return item.visitors || 0;
    if (sortBy === 'signups') return item.signups || 0;
    return item.connections || 0;
  };

  // Filter out Unknown from display but keep for totals
  const filteredCountries = countries.filter(c => c.name && c.name !== 'Unknown' && c.name !== 'null');
  const filteredCities = cities.filter(c => c.name && c.name !== 'Unknown' && c.name !== 'null');
  const filteredRegions = regions.filter(r => r.name && r.name !== 'Unknown' && r.name !== 'null');

  // Sort all data by sortBy
  const sortedCountries = [...filteredCountries].sort((a, b) => getSortValue(b) - getSortValue(a));
  const sortedRegions = [...filteredRegions].sort((a, b) => getSortValue(b) - getSortValue(a));
  const sortedCities = [...filteredCities].sort((a, b) => getSortValue(b) - getSortValue(a));

  const maxCountryValue = Math.max(...filteredCountries.map(c => getSortValue(c)), 1);
  const maxRegionValue = Math.max(...filteredRegions.map(r => getSortValue(r)), 1);
  const maxCityValue = Math.max(...filteredCities.map(c => getSortValue(c)), 1);
  
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
    const maxVisitors = Math.max(...Object.values(countryVisitorMap), 1);
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
                    { label: 'Signups', value: country.signups || 0 },
                    { label: 'Connections', value: country.connections },
                    { label: 'Conv. Rate', value: `${country.visitors > 0 ? ((country.connections / country.visitors) * 100).toFixed(1) : 0}%`, highlight: true },
                  ]}
                >
                  <ProportionalBar 
                    value={getSortValue(country)} 
                    maxValue={maxCountryValue}
                    secondaryValue={country.connections}
                    secondaryMaxValue={Math.max(...filteredCountries.map(c => c.connections), 1)}
                  >
                    <div className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{getFlag(country.name)}</span>
                        <span className="text-sm font-medium">{country.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {country.connections > 0 && (
                          <span className="text-xs text-[hsl(12_95%_60%)] font-medium tabular-nums">
                            {country.connections} conv
                          </span>
                        )}
                        <span className="text-sm font-medium tabular-nums w-10 text-right">
                          {getSortValue(country).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </ProportionalBar>
                </AnalyticsTooltip>
              ))}
              {sortedCountries.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No country data</div>
              )}
            </div>
          )}
          
          {activeTab === 'region' && (
            <div className="space-y-1">
              {sortedRegions.slice(0, 8).map((region, i) => (
                <AnalyticsTooltip
                  key={`${region.name}-${i}`}
                  title={region.name}
                  rows={[
                    { label: 'Country', value: region.country },
                    { label: 'Visitors', value: region.visitors.toLocaleString() },
                    { label: 'Signups', value: region.signups || 0 },
                    { label: 'Connections', value: region.connections },
                    { label: 'Conv. Rate', value: `${region.visitors > 0 ? ((region.connections / region.visitors) * 100).toFixed(1) : 0}%`, highlight: true },
                  ]}
                >
                  <ProportionalBar 
                    value={getSortValue(region)} 
                    maxValue={maxRegionValue}
                    secondaryValue={region.connections}
                    secondaryMaxValue={Math.max(...filteredRegions.map(r => r.connections), 1)}
                  >
                    <div className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{getFlag(region.country)}</span>
                        <span className="text-sm font-medium">{region.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {region.connections > 0 && (
                          <span className="text-xs text-[hsl(12_95%_60%)] font-medium tabular-nums">
                            {region.connections} conv
                          </span>
                        )}
                        <span className="text-sm font-medium tabular-nums w-10 text-right">
                          {getSortValue(region).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </ProportionalBar>
                </AnalyticsTooltip>
              ))}
              {sortedRegions.length === 0 && (
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
                    { label: 'Signups', value: city.signups || 0 },
                    { label: 'Connections', value: city.connections },
                    { label: 'Conv. Rate', value: `${city.visitors > 0 ? ((city.connections / city.visitors) * 100).toFixed(1) : 0}%`, highlight: true },
                  ]}
                >
                  <ProportionalBar 
                    value={getSortValue(city)} 
                    maxValue={maxCityValue}
                    secondaryValue={city.connections}
                    secondaryMaxValue={Math.max(...filteredCities.map(c => c.connections), 1)}
                  >
                    <div className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{getFlag(city.country)}</span>
                        <span className="text-sm font-medium">{city.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {city.connections > 0 && (
                          <span className="text-xs text-[hsl(12_95%_60%)] font-medium tabular-nums">
                            {city.connections} conv
                          </span>
                        )}
                        <span className="text-sm font-medium tabular-nums w-10 text-right">
                          {getSortValue(city).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </ProportionalBar>
                </AnalyticsTooltip>
              ))}
              {sortedCities.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No city data</div>
              )}
            </div>
          )}
        </div>
      )}
    </AnalyticsCard>
  );
}
