import { useState, useEffect, useMemo } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { cn } from "@/lib/utils";
import { UserTooltipCard } from "./UserTooltipCard";
import type { EnhancedActiveUser } from "@/hooks/useEnhancedRealTimeAnalytics";
import { getAvatarColor, getInitials } from "@/lib/anonymousNames";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface PremiumGlobeMapProps {
  users: EnhancedActiveUser[];
  onUserClick?: (user: EnhancedActiveUser) => void;
  className?: string;
}

export function PremiumGlobeMap({ users, onUserClick, className }: PremiumGlobeMapProps) {
  const [hoveredUser, setHoveredUser] = useState<EnhancedActiveUser | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // Auto-rotate the globe
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.3) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, [isPaused]);
  
  // Filter users with coordinates
  const usersWithCoords = useMemo(() => 
    users.filter(u => u.coordinates !== null),
    [users]
  );

  const handleMouseEnter = (user: EnhancedActiveUser, event: React.MouseEvent) => {
    setHoveredUser(user);
    setTooltipPos({ x: event.clientX, y: event.clientY });
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    setHoveredUser(null);
    setTooltipPos(null);
    setIsPaused(false);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (hoveredUser) {
      setTooltipPos({ x: event.clientX, y: event.clientY });
    }
  };

  return (
    <div 
      className={cn(
        "relative rounded-2xl overflow-hidden",
        className
      )}
      onMouseMove={handleMouseMove}
      style={{
        background: 'radial-gradient(ellipse at center, #0a1628 0%, #020617 100%)',
      }}
    >
      {/* Star background effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(1px 1px at 20% 50%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 30% 30%, rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1px 1px at 40% 70%, rgba(255,255,255,0.15) 0%, transparent 100%),
            radial-gradient(1px 1px at 50% 10%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 60% 40%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(1px 1px at 70% 60%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 80% 25%, rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1px 1px at 90% 80%, rgba(255,255,255,0.15) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 15% 85%, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 85% 15%, rgba(255,255,255,0.35) 0%, transparent 100%),
            radial-gradient(1px 1px at 45% 55%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 55% 35%, rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1px 1px at 75% 45%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 25% 75%, rgba(255,255,255,0.15) 0%, transparent 100%)
          `,
        }}
      />
      
      {/* Ambient glow around globe */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="w-[500px] h-[500px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, rgba(99,102,241,0.1) 40%, transparent 70%)',
          }}
        />
      </div>
      
      {/* Map container */}
      <div className="relative h-[600px] w-full">
        <ComposableMap
          projection="geoOrthographic"
          projectionConfig={{
            scale: 280,
            rotate: [-rotation, -20, 0],
            center: [0, 0],
          }}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Globe sphere background */}
          <circle 
            cx={400} 
            cy={300} 
            r={280} 
            fill="url(#globeGradient)" 
            stroke="rgba(99,102,241,0.2)"
            strokeWidth={1}
          />
          <defs>
            <radialGradient id="globeGradient" cx="30%" cy="30%">
              <stop offset="0%" stopColor="#1e3a5f" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>
          </defs>
          
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#1e3a5f"
                  stroke="#2d4a6f"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: "#2d4a6f" },
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
                {/* Outer pulse ring */}
                <circle
                  r={24}
                  fill="none"
                  stroke="hsl(0, 84%, 60%)"
                  strokeWidth={1.5}
                  opacity={0.4}
                  className="animate-ping"
                  style={{ animationDuration: '2s' }}
                />
                
                {/* Middle glow */}
                <circle
                  r={18}
                  fill="hsl(0, 84%, 60%)"
                  opacity={0.15}
                />
                
                {/* Avatar circle */}
                <circle
                  r={12}
                  fill={getAvatarFill(user)}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth={2}
                  className="transition-transform hover:scale-110"
                />
                
                {/* Initials text */}
                <text
                  textAnchor="middle"
                  y={4}
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    fill: "white",
                    pointerEvents: "none",
                    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                  }}
                >
                  {getInitials(user.displayName)}
                </text>
              </g>
            </Marker>
          ))}
        </ComposableMap>
      </div>

      {/* Tooltip */}
      {hoveredUser && tooltipPos && (
        <UserTooltipCard user={hoveredUser} position={tooltipPos} />
      )}

      {/* Active count badge - top right */}
      <div className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/10">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-coral-500"></span>
        </span>
        <span className="text-sm font-medium text-white">{users.length} active</span>
      </div>
      
      {/* User legend - bottom */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
        {users.slice(0, 8).map((user) => (
          <div 
            key={user.sessionId}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
            onMouseEnter={(e) => handleMouseEnter(user, e)}
            onMouseLeave={handleMouseLeave}
          >
            <div className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white",
              user.isAnonymous ? getAvatarColor(user.displayName) : getBuyerTypeColorClass(user.buyerType)
            )}>
              {getInitials(user.displayName)}
            </div>
            <span className="text-xs text-white/90 truncate max-w-[100px]">
              {user.displayName}
            </span>
          </div>
        ))}
        {users.length > 8 && (
          <div className="flex items-center px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-xs text-white/60">
            +{users.length - 8} more
          </div>
        )}
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
