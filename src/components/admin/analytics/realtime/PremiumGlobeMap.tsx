import { useState, useEffect, useMemo, useRef } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { cn } from "@/lib/utils";
import { UserTooltipCard } from "./UserTooltipCard";
import type { EnhancedActiveUser } from "@/hooks/useEnhancedRealTimeAnalytics";
import { getAvatarColor, getInitials } from "@/lib/anonymousNames";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface PremiumGlobeMapProps {
  users: EnhancedActiveUser[];
  onUserClick?: (user: EnhancedActiveUser) => void;
  focusedSessionId?: string | null;
  className?: string;
}

export function PremiumGlobeMap({ users, onUserClick, focusedSessionId, className }: PremiumGlobeMapProps) {
  const [hoveredUser, setHoveredUser] = useState<EnhancedActiveUser | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [rotation, setRotation] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [highlightedSession, setHighlightedSession] = useState<string | null>(null);
  
  // Pinned tooltip state
  const [pinnedUser, setPinnedUser] = useState<EnhancedActiveUser | null>(null);
  const [pinnedTooltipPos, setPinnedTooltipPos] = useState<{ x: number; y: number } | null>(null);
  
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const baseRotationOnDragStart = useRef(0);
  
  // Auto-rotate the globe (unless manually paused by drag)
  useEffect(() => {
    if (isPaused || isManuallyPaused) return;
    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.3) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, [isPaused, isManuallyPaused]);
  
  // Focus on a user when clicked from activity feed
  useEffect(() => {
    if (focusedSessionId) {
      const user = users.find(u => u.sessionId === focusedSessionId);
      if (user?.coordinates) {
        // Rotate globe to center on this user's longitude
        setRotation(-user.coordinates.lng);
        setDragOffset(0);
        setIsManuallyPaused(true);
        setHighlightedSession(focusedSessionId);
        // Clear highlight after 3 seconds
        setTimeout(() => setHighlightedSession(null), 3000);
      }
    }
  }, [focusedSessionId, users]);
  
  // Drag handlers for rotation
  const handleGlobeMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    baseRotationOnDragStart.current = rotation;
    isDragging.current = true;
  };
  
  const handleGlobeMouseMove = (e: React.MouseEvent) => {
    // Update tooltip position during hover
    if (hoveredUser && !isDragging.current) {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    }
    
    // Handle drag-to-rotate
    if (isDragging.current && dragStartPos.current) {
      const dx = e.clientX - dragStartPos.current.x;
      // Convert pixel delta to rotation degrees (sensitivity factor)
      setDragOffset(dx * 0.3);
    }
  };
  
  const handleGlobeMouseUp = (e: React.MouseEvent) => {
    if (dragStartPos.current && isDragging.current) {
      const dx = e.clientX - dragStartPos.current.x;
      // If moved more than 5px, apply the rotation
      if (Math.abs(dx) > 5) {
        setRotation(prev => (prev + dragOffset) % 360);
        setIsManuallyPaused(true);
      }
    }
    isDragging.current = false;
    setDragOffset(0);
    dragStartPos.current = null;
  };
  
  const handleGlobeMouseLeave = () => {
    // If we leave while dragging, apply the rotation
    if (isDragging.current && dragOffset !== 0) {
      setRotation(prev => (prev + dragOffset) % 360);
      setIsManuallyPaused(true);
    }
    isDragging.current = false;
    setDragOffset(0);
    dragStartPos.current = null;
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      baseRotationOnDragStart.current = rotation;
      isDragging.current = true;
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging.current && dragStartPos.current && e.touches.length === 1) {
      const dx = e.touches[0].clientX - dragStartPos.current.x;
      setDragOffset(dx * 0.3);
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartPos.current && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - dragStartPos.current.x;
      if (Math.abs(dx) > 5) {
        setRotation(prev => (prev + dragOffset) % 360);
        setIsManuallyPaused(true);
      }
    }
    isDragging.current = false;
    setDragOffset(0);
    dragStartPos.current = null;
  };
  
  // Filter users with coordinates
  const usersWithCoords = useMemo(() => 
    users.filter(u => u.coordinates !== null),
    [users]
  );

  const handleMouseEnter = (user: EnhancedActiveUser, event: React.MouseEvent) => {
    if (!pinnedUser) {
      setHoveredUser(user);
      setTooltipPos({ x: event.clientX, y: event.clientY });
    }
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    if (!pinnedUser) {
      setHoveredUser(null);
      setTooltipPos(null);
    }
    setIsPaused(false);
  };

  // Click on marker to pin
  const handleMarkerClick = (user: EnhancedActiveUser, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (pinnedUser?.sessionId === user.sessionId) {
      // Clicking same user unpins
      setPinnedUser(null);
      setPinnedTooltipPos(null);
    } else {
      // Pin new user
      setPinnedUser(user);
      setPinnedTooltipPos({ x: e.clientX, y: e.clientY });
      setHoveredUser(null);
    }
    
    onUserClick?.(user);
  };
  
  // Click on globe background to close pinned tooltip
  const handleGlobeBackgroundClick = () => {
    if (pinnedUser && !isDragging.current) {
      setPinnedUser(null);
      setPinnedTooltipPos(null);
    }
  };

  // Effective rotation for display (base + drag offset)
  const effectiveRotation = rotation + dragOffset;

  return (
    <div 
      className={cn(
        "relative rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing",
        className
      )}
      onMouseMove={handleGlobeMouseMove}
      onMouseDown={handleGlobeMouseDown}
      onMouseUp={handleGlobeMouseUp}
      onMouseLeave={handleGlobeMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleGlobeBackgroundClick}
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
            rotate: [-effectiveRotation, -20, 0],
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
          {usersWithCoords.map((user) => {
            const isHighlighted = highlightedSession === user.sessionId;
            const isPinned = pinnedUser?.sessionId === user.sessionId;
            return (
              <Marker 
                key={user.sessionId} 
                coordinates={[user.coordinates!.lng, user.coordinates!.lat]}
              >
                <g
                  onMouseEnter={(e) => handleMouseEnter(user, e as unknown as React.MouseEvent)}
                  onMouseLeave={handleMouseLeave}
                  onClick={(e) => handleMarkerClick(user, e as unknown as React.MouseEvent)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Highlight ring for focused/pinned user */}
                  {(isHighlighted || isPinned) && (
                    <>
                      <circle
                        r={40}
                        fill="none"
                        stroke={isPinned ? "hsl(0, 84%, 60%)" : "hsl(45, 100%, 60%)"}
                        strokeWidth={3}
                        opacity={0.8}
                        className="animate-ping"
                        style={{ animationDuration: '1s' }}
                      />
                      <circle
                        r={32}
                        fill={isPinned ? "hsl(0, 84%, 50%)" : "hsl(45, 100%, 50%)"}
                        opacity={0.2}
                      />
                    </>
                  )}
                  
                  {/* Outer pulse ring */}
                  <circle
                    r={24}
                    fill="none"
                    stroke={isHighlighted || isPinned ? "hsl(45, 100%, 60%)" : "hsl(0, 84%, 60%)"}
                    strokeWidth={isHighlighted || isPinned ? 2 : 1.5}
                    opacity={isHighlighted || isPinned ? 0.8 : 0.4}
                    className="animate-ping"
                    style={{ animationDuration: '2s' }}
                  />
                  
                  {/* Middle glow */}
                  <circle
                    r={18}
                    fill={isHighlighted || isPinned ? "hsl(45, 100%, 60%)" : "hsl(0, 84%, 60%)"}
                    opacity={isHighlighted || isPinned ? 0.3 : 0.15}
                  />
                  
                  {/* Avatar circle */}
                  <circle
                    r={isHighlighted || isPinned ? 16 : 12}
                    fill={getAvatarFill(user)}
                    stroke={isHighlighted || isPinned ? "hsl(45, 100%, 70%)" : "rgba(255,255,255,0.9)"}
                    strokeWidth={isHighlighted || isPinned ? 3 : 2}
                    className="transition-transform hover:scale-110"
                  />
                  
                  {/* Initials text */}
                  <text
                    textAnchor="middle"
                    y={4}
                    style={{
                      fontSize: isHighlighted || isPinned ? "12px" : "10px",
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
            );
          })}
        </ComposableMap>
      </div>

      {/* Hover Tooltip (only show if not pinned) */}
      {hoveredUser && !pinnedUser && tooltipPos && (
        <UserTooltipCard user={hoveredUser} position={tooltipPos} />
      )}
      
      {/* Pinned Tooltip */}
      {pinnedUser && pinnedTooltipPos && (
        <UserTooltipCard 
          user={pinnedUser} 
          position={pinnedTooltipPos}
          pinned={true}
          onClose={() => { setPinnedUser(null); setPinnedTooltipPos(null); }}
        />
      )}

      {/* Active count badge - top right */}
      <div className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/10">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-coral-500"></span>
        </span>
        <span className="text-sm font-medium text-white">{users.length} active</span>
      </div>
      
      {/* Resume rotation button when paused */}
      {isManuallyPaused && (
        <button
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-xs text-white/80 hover:bg-white/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setIsManuallyPaused(false);
          }}
        >
          ▶ Resume rotation
        </button>
      )}
      
      {/* User legend - bottom */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
        {users.slice(0, 8).map((user) => (
          <div 
            key={user.sessionId}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border cursor-pointer hover:bg-white/10 transition-colors",
              pinnedUser?.sessionId === user.sessionId 
                ? "border-coral-500" 
                : "border-white/10"
            )}
            onMouseEnter={(e) => handleMouseEnter(user, e)}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => handleMarkerClick(user, e)}
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
