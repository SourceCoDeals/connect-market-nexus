import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { cn } from "@/lib/utils";

// Simple world map topology
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Approximate country center coordinates
const countryCoordinates: Record<string, [number, number]> = {
  'United States': [-98.5795, 39.8283],
  'Canada': [-106.3468, 56.1304],
  'United Kingdom': [-3.4360, 55.3781],
  'Germany': [10.4515, 51.1657],
  'France': [2.2137, 46.6034],
  'Australia': [133.7751, -25.2744],
  'India': [78.9629, 20.5937],
  'Brazil': [-51.9253, -14.2350],
  'Mexico': [-102.5528, 23.6345],
  'Japan': [138.2529, 36.2048],
  'China': [104.1954, 35.8617],
  'South Korea': [127.7669, 35.9078],
  'Spain': [-3.7492, 40.4637],
  'Italy': [12.5674, 41.8719],
  'Netherlands': [5.2913, 52.1326],
  'Singapore': [103.8198, 1.3521],
};

interface LiveActivityMapProps {
  data: Array<{ country: string; count: number }>;
}

export function LiveActivityMap({ data }: LiveActivityMapProps) {
  // Get markers with coordinates
  const markers = data
    .filter(d => countryCoordinates[d.country])
    .map(d => ({
      country: d.country,
      count: d.count,
      coordinates: countryCoordinates[d.country],
    }));

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Active Users by Location
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Real-time geographic distribution
        </p>
      </div>

      <div className="relative h-[280px] w-full">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 120,
            center: [0, 30],
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="hsl(var(--muted))"
                  stroke="hsl(var(--border))"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: "hsl(var(--muted-foreground) / 0.2)" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {markers.map((marker, i) => (
            <Marker key={marker.country} coordinates={marker.coordinates}>
              {/* Pulse animation */}
              <circle
                r={4 + (marker.count / maxCount) * 8}
                fill="hsl(var(--coral-500) / 0.3)"
                className="animate-pulse"
              />
              {/* Center dot */}
              <circle
                r={3 + (marker.count / maxCount) * 4}
                fill="hsl(var(--coral-500))"
              />
              {/* Count label for high-activity locations */}
              {marker.count > 1 && (
                <text
                  textAnchor="middle"
                  y={-12}
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    fill: "hsl(var(--foreground))",
                  }}
                >
                  {marker.count}
                </text>
              )}
            </Marker>
          ))}
        </ComposableMap>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-4">
        {data.slice(0, 5).map((d, i) => (
          <div 
            key={d.country}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 text-xs"
          >
            <span className="h-2 w-2 rounded-full bg-coral-500" />
            <span className="text-muted-foreground">{d.country}</span>
            <span className="font-medium">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
