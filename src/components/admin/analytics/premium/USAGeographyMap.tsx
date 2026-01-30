import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { cn } from "@/lib/utils";

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

interface USAGeographyMapProps {
  data: Array<{ region: string; count: number }>;
  className?: string;
}

// Map regions to state FIPS codes
const regionToStates: Record<string, string[]> = {
  'Northeast US': ['09', '23', '25', '33', '44', '50', '34', '36', '42'],
  'Southeast US': ['01', '05', '12', '13', '21', '22', '28', '37', '45', '47', '51', '54'],
  'Midwest US': ['17', '18', '19', '20', '26', '27', '29', '31', '38', '39', '46', '55'],
  'Western US': ['04', '06', '08', '16', '30', '32', '35', '41', '49', '53', '56'],
  'Southwest US': ['48', '35', '40'],
  'Texas': ['48'],
  'California': ['06'],
  'New York': ['36'],
  'Florida': ['12'],
  'Nationwide': [],
};

const stateNames: Record<string, string> = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas', '06': 'California',
  '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware', '11': 'District of Columbia',
  '12': 'Florida', '13': 'Georgia', '15': 'Hawaii', '16': 'Idaho', '17': 'Illinois',
  '18': 'Indiana', '19': 'Iowa', '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana',
  '23': 'Maine', '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
  '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska', '32': 'Nevada',
  '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico', '36': 'New York',
  '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio', '40': 'Oklahoma', '41': 'Oregon',
  '42': 'Pennsylvania', '44': 'Rhode Island', '45': 'South Carolina', '46': 'South Dakota',
  '47': 'Tennessee', '48': 'Texas', '49': 'Utah', '50': 'Vermont', '51': 'Virginia',
  '53': 'Washington', '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming'
};

export function USAGeographyMap({ data, className }: USAGeographyMapProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = useState<{ name: string; value: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Transform region data to state-level data
  const stateData = useMemo(() => {
    const stateMap: Record<string, number> = {};
    
    data.forEach(({ region, count }) => {
      const states = regionToStates[region] || [];
      const countPerState = states.length > 0 ? Math.ceil(count / states.length) : 0;
      
      states.forEach(stateId => {
        stateMap[stateId] = (stateMap[stateId] || 0) + countPerState;
      });
      
      // Handle nationwide - distribute across all states
      if (region === 'Nationwide' || region === 'National') {
        Object.keys(stateNames).forEach(stateId => {
          stateMap[stateId] = (stateMap[stateId] || 0) + Math.ceil(count / 50);
        });
      }
    });
    
    return stateMap;
  }, [data]);

  const maxValue = useMemo(() => 
    Math.max(...Object.values(stateData), 1),
    [stateData]
  );

  const getStateColor = (stateId: string) => {
    const value = stateData[stateId] || 0;
    if (value === 0) return "hsl(var(--muted))";
    
    const intensity = Math.min(value / maxValue, 1);
    // Use coral color scale
    if (intensity < 0.25) return "hsl(0 100% 94%)";
    if (intensity < 0.5) return "hsl(0 85% 85%)";
    if (intensity < 0.75) return "hsl(0 75% 72%)";
    return "hsl(0 65% 60%)";
  };

  const handleMouseMove = (e: React.MouseEvent, stateId: string) => {
    const stateName = stateNames[stateId] || 'Unknown';
    const value = stateData[stateId] || 0;
    setTooltipContent({ name: stateName, value });
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className={cn(
      "relative rounded-2xl bg-card border border-border/50 p-6",
      "overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Buyer Geography
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Interest concentration by region
        </p>
      </div>

      {/* Map */}
      <div className="relative aspect-[1.6/1]">
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 1000 }}
          className="w-full h-full"
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const stateId = geo.id;
                const isHovered = hoveredState === stateId;
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getStateColor(stateId)}
                    stroke="hsl(var(--background))"
                    strokeWidth={0.5}
                    style={{
                      default: {
                        outline: "none",
                        transition: "all 150ms",
                      },
                      hover: {
                        outline: "none",
                        fill: "hsl(0 65% 55%)",
                        cursor: "pointer",
                      },
                      pressed: {
                        outline: "none",
                      },
                    }}
                    onMouseEnter={() => setHoveredState(stateId)}
                    onMouseLeave={() => {
                      setHoveredState(null);
                      setTooltipContent(null);
                    }}
                    onMouseMove={(e) => handleMouseMove(e, stateId)}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="text-[10px] text-muted-foreground">Low</span>
        <div className="flex gap-0.5">
          <div className="w-6 h-2 rounded-sm" style={{ backgroundColor: "hsl(0 100% 94%)" }} />
          <div className="w-6 h-2 rounded-sm" style={{ backgroundColor: "hsl(0 85% 85%)" }} />
          <div className="w-6 h-2 rounded-sm" style={{ backgroundColor: "hsl(0 75% 72%)" }} />
          <div className="w-6 h-2 rounded-sm" style={{ backgroundColor: "hsl(0 65% 60%)" }} />
        </div>
        <span className="text-[10px] text-muted-foreground">High</span>
      </div>

      {/* Tooltip */}
      {tooltipContent && (
        <div 
          className="fixed z-50 px-3 py-2 bg-navy-900 text-white text-xs rounded-lg shadow-xl pointer-events-none"
          style={{ 
            left: tooltipPos.x + 10, 
            top: tooltipPos.y - 30,
          }}
        >
          <p className="font-medium">{tooltipContent.name}</p>
          <p className="text-coral-300">{tooltipContent.value} buyers</p>
        </div>
      )}
    </div>
  );
}
