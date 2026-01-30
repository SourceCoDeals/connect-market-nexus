import { useState, useMemo } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { cn } from "@/lib/utils";
import { UserTooltipCard } from "./UserTooltipCard";
import type { EnhancedActiveUser } from "@/hooks/useEnhancedRealTimeAnalytics";
import { getAvatarColor, getInitials } from "@/lib/anonymousNames";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface PremiumGlobeMapProps {
  users: EnhancedActiveUser[];
  onUserClick?: (user: EnhancedActiveUser) => void;
}

export function PremiumGlobeMap({ users, onUserClick }: PremiumGlobeMapProps) {
  const [hoveredUser, setHoveredUser] = useState<EnhancedActiveUser | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  
  // Filter users with coordinates
  const usersWithCoords = useMemo(() => 
    users.filter(u => u.coordinates !== null),
    [users]
  );

  const handleMouseEnter = (user: EnhancedActiveUser, event: React.MouseEvent) => {
    setHoveredUser(user);
    setTooltipPos({ x: event.clientX, y: event.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredUser(null);
    setTooltipPos(null);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (hoveredUser) {
      setTooltipPos({ x: event.clientX, y: event.clientY });
    }
  };

  return (
    <div 
      className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      onMouseMove={handleMouseMove}
    >
      {/* Ambient glow effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-coral-500/5 via-transparent to-transparent pointer-events-none" />
      
      {/* Map container */}
      <div className="relative h-[400px] w-full">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 140,
            center: [0, 25],
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup center={[0, 20]} zoom={1}>
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="hsl(217, 33%, 17%)"
                    stroke="hsl(217, 19%, 27%)"
                    strokeWidth={0.3}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", fill: "hsl(217, 33%, 22%)" },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            {/* User markers */}
            {usersWithCoords.map((user) => (
              <Marker 
                key={user.sessionId} 
                coordinates={[user.coordinates!.lng, user.coordinates!.lat]}
              >
                <g
                  onMouseEnter={(e) => handleMouseEnter(user, e as unknown as React.MouseEvent)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => onUserClick?.(user)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Pulse animation rings */}
                  <circle
                    r={18}
                    fill="none"
                    stroke="hsl(0, 84%, 60%)"
                    strokeWidth={1}
                    opacity={0.3}
                    className="animate-ping"
                    style={{ animationDuration: '2s' }}
                  />
                  <circle
                    r={12}
                    fill="hsl(0, 84%, 60%)"
                    opacity={0.2}
                  />
                  
                  {/* Avatar circle */}
                  <circle
                    r={8}
                    fill={getAvatarFill(user)}
                    stroke="hsl(0, 0%, 100%)"
                    strokeWidth={1.5}
                    opacity={0.95}
                    className="transition-transform hover:scale-125"
                  />
                  
                  {/* Initials text */}
                  <text
                    textAnchor="middle"
                    y={3}
                    style={{
                      fontSize: "7px",
                      fontWeight: 700,
                      fill: "white",
                      pointerEvents: "none",
                    }}
                  >
                    {getInitials(user.displayName)}
                  </text>
                </g>
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Tooltip */}
      {hoveredUser && tooltipPos && (
        <UserTooltipCard user={hoveredUser} position={tooltipPos} />
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
        {users.slice(0, 6).map((user) => (
          <div 
            key={user.sessionId}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs cursor-pointer hover:bg-white/20 transition-colors"
            onMouseEnter={(e) => handleMouseEnter(user, e)}
            onMouseLeave={handleMouseLeave}
          >
            <div className={cn(
              "w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white",
              user.isAnonymous ? getAvatarColor(user.displayName) : getBuyerTypeColorClass(user.buyerType)
            )}>
              {getInitials(user.displayName)}
            </div>
            <span className="text-white/80 truncate max-w-[80px]">
              {user.displayName}
            </span>
          </div>
        ))}
        {users.length > 6 && (
          <div className="flex items-center px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs text-white/60">
            +{users.length - 6} more
          </div>
        )}
      </div>

      {/* Active count badge */}
      <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-coral-500"></span>
        </span>
        <span className="text-xs font-medium text-white">{users.length} active</span>
      </div>
    </div>
  );
}

function getAvatarFill(user: EnhancedActiveUser): string {
  if (user.isAnonymous) {
    const colorMap: Record<string, string> = {
      coral: '#f87171',
      azure: '#3b82f6',
      amber: '#f59e0b',
      jade: '#10b981',
      violet: '#8b5cf6',
      rose: '#f43f5e',
      teal: '#14b8a6',
      gold: '#eab308',
      crimson: '#dc2626',
      sage: '#22c55e',
      cobalt: '#4f46e5',
      peach: '#fb923c',
      mint: '#22d3ee',
      ruby: '#ec4899',
      slate: '#64748b',
      bronze: '#ea580c',
    };
    const colorWord = user.displayName.split(' ')[0];
    return colorMap[colorWord] || '#64748b';
  }
  
  const buyerColors: Record<string, string> = {
    'privateEquity': '#8b5cf6',
    'familyOffice': '#10b981',
    'corporate': '#3b82f6',
    'searchFund': '#f59e0b',
    'independentSponsor': '#06b6d4',
    'individual': '#f43f5e',
  };
  
  return buyerColors[user.buyerType || ''] || '#64748b';
}

function getBuyerTypeColorClass(buyerType: string | null): string {
  const colorMap: Record<string, string> = {
    'privateEquity': 'bg-violet-500',
    'familyOffice': 'bg-emerald-500',
    'corporate': 'bg-blue-500',
    'searchFund': 'bg-amber-500',
    'independentSponsor': 'bg-cyan-500',
    'individual': 'bg-rose-500',
  };
  
  return colorMap[buyerType || ''] || 'bg-slate-500';
}
