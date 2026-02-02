import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { cn } from '@/lib/utils';
import { countryCodeToFlag } from '@/lib/flagEmoji';
import type { EnhancedActiveUser, EnhancedRealTimeData } from '@/hooks/useEnhancedRealTimeAnalytics';
import { MapboxFloatingPanel } from './MapboxFloatingPanel';
import { MapboxTooltipCard } from './MapboxTooltipCard';
import { LiveActivityFeed } from './LiveActivityFeed';

interface MapboxGlobeMapProps {
  users: EnhancedActiveUser[];
  events?: EnhancedRealTimeData['recentEvents'];
  onUserClick?: (user: EnhancedActiveUser) => void;
  focusedSessionId?: string | null;
  className?: string;
}

// DiceBear avatar URL generator
function getAvatarUrl(user: EnhancedActiveUser): string {
  const seed = user.sessionId || user.displayName;
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

// Calculate buyer breakdown for the floating panel
export interface BuyerBreakdown {
  loggedInCount: number;
  loggedInPercent: number;
  ndaSignedCount: number;
  feeAgreementCount: number;
  connectionsThisHour: number;
}

export function MapboxGlobeMap({ 
  users, 
  events = [],
  onUserClick, 
  focusedSessionId,
  className 
}: MapboxGlobeMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [selectedUser, setSelectedUser] = useState<EnhancedActiveUser | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const spinEnabledRef = useRef(true);
  const userInteractingRef = useRef(false);

  // Fetch Mapbox token from edge function
  useEffect(() => {
    async function fetchToken() {
      try {
        const response = await fetch(
          'https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/get-mapbox-token',
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.token) {
            setMapboxToken(data.token);
          }
        }
      } catch (error) {
        console.error('Failed to fetch Mapbox token:', error);
      } finally {
        setTokenLoading(false);
      }
    }
    
    fetchToken();
  }, []);

  // Calculate buyer breakdown (real M&A data)
  const buyerBreakdown: BuyerBreakdown = {
    loggedInCount: users.filter(u => !u.isAnonymous).length,
    loggedInPercent: users.length > 0 
      ? Math.round((users.filter(u => !u.isAnonymous).length / users.length) * 100) 
      : 0,
    ndaSignedCount: users.filter(u => u.ndaSigned).length,
    feeAgreementCount: users.filter(u => u.feeAgreementSigned).length,
    connectionsThisHour: users.reduce((sum, u) => sum + u.connectionsSent, 0),
  };
  
  // Use pre-normalized entrySource from useEnhancedRealTimeAnalytics
  const referrerBreakdown = users.reduce((acc, user) => {
    const source = user.entrySource || 'Direct';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const countryBreakdown = users.reduce((acc, user) => {
    const country = user.country || 'Unknown';
    if (!acc[country]) {
      acc[country] = { count: 0, flag: countryCodeToFlag(user.countryCode) };
    }
    acc[country].count++;
    return acc;
  }, {} as Record<string, { count: number; flag: string }>);

  const deviceBreakdown = users.reduce((acc, user) => {
    const device = user.deviceType || 'desktop';
    acc[device] = (acc[device] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      projection: 'globe',
      center: [0, 20],
      zoom: 1.5,
      minZoom: 1,
      maxZoom: 15,
      attributionControl: false,
    });

    map.on('load', () => {
      // Add atmosphere effect
      map.setFog({
        color: 'rgb(186, 210, 235)',
        'high-color': 'rgb(36, 92, 223)',
        'horizon-blend': 0.02,
        'space-color': 'rgb(11, 11, 25)',
        'star-intensity': 0.6,
      });
      setIsMapLoaded(true);
    });

    // Track user interaction for auto-rotation pause
    map.on('mousedown', () => {
      userInteractingRef.current = true;
    });
    map.on('mouseup', () => {
      userInteractingRef.current = false;
    });
    map.on('dragend', () => {
      userInteractingRef.current = false;
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  // Auto-rotation
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    let animationId: number;
    const secondsPerRevolution = 240;
    const maxSpinZoom = 5;
    const slowSpinZoom = 3;

    const spinGlobe = () => {
      const map = mapRef.current;
      if (!map || userInteractingRef.current || !spinEnabledRef.current) {
        animationId = requestAnimationFrame(spinGlobe);
        return;
      }

      const zoom = map.getZoom();
      if (zoom < maxSpinZoom) {
        let distancePerSecond = 360 / secondsPerRevolution;
        if (zoom > slowSpinZoom) {
          const zoomDif = (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
          distancePerSecond *= zoomDif;
        }
        const center = map.getCenter();
        center.lng -= distancePerSecond / 60;
        map.easeTo({ center, duration: 1000, easing: (n) => n });
      }
      
      animationId = requestAnimationFrame(spinGlobe);
    };

    spinGlobe();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isMapLoaded]);

  // Add user markers
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    users.forEach(user => {
      if (!user.coordinates) return;

      const el = document.createElement('div');
      el.className = 'mapbox-user-marker';
      
      // High value = logged in with NDA or active engagement
      const isHighValue = !user.isAnonymous && (user.ndaSigned || user.connectionsSent > 0 || user.listingsSaved > 0);
      
      el.innerHTML = `
        <div class="marker-container ${isHighValue ? 'high-value' : ''}">
          <div class="marker-pulse"></div>
          <div class="marker-avatar">
            <img src="${getAvatarUrl(user)}" alt="${user.displayName}" />
          </div>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedUser(user);
        setTooltipPosition({ x: e.clientX, y: e.clientY });
        onUserClick?.(user);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([user.coordinates.lng, user.coordinates.lat])
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [users, isMapLoaded, onUserClick]);

  // Focus on user when focusedSessionId changes
  useEffect(() => {
    if (!mapRef.current || !focusedSessionId || !isMapLoaded) return;

    const user = users.find(u => u.sessionId === focusedSessionId);
    if (user?.coordinates) {
      spinEnabledRef.current = false;
      
      mapRef.current.flyTo({
        center: [user.coordinates.lng, user.coordinates.lat],
        zoom: 4,
        duration: 2000,
        essential: true,
      });

      // Re-enable spin after fly-to completes
      setTimeout(() => {
        spinEnabledRef.current = true;
      }, 3000);

      // Show tooltip for focused user
      setSelectedUser(user);
    }
  }, [focusedSessionId, users, isMapLoaded]);

  const handleCloseTooltip = useCallback(() => {
    setSelectedUser(null);
    setTooltipPosition(null);
  }, []);

  const handleActivityClick = useCallback((sessionId: string) => {
    const user = users.find(u => u.sessionId === sessionId);
    if (user && user.coordinates && mapRef.current) {
      spinEnabledRef.current = false;
      
      mapRef.current.flyTo({
        center: [user.coordinates.lng, user.coordinates.lat],
        zoom: 4,
        duration: 2000,
        essential: true,
      });

      setTimeout(() => {
        spinEnabledRef.current = true;
      }, 3000);

      setSelectedUser(user);
    }
  }, [users]);

  // Show loading state or error
  if (tokenLoading) {
    return (
      <div className={cn("relative flex items-center justify-center bg-[#0b0b19]", className)}>
        <div className="text-center p-8">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-white/50 text-sm">Loading globe...</p>
        </div>
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div className={cn("relative flex items-center justify-center bg-slate-900", className)}>
        <div className="text-center p-8">
          <p className="text-white/60 text-sm mb-2">Mapbox token not configured</p>
          <p className="text-white/40 text-xs">Configure the edge function secret to enable the 3D globe</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-[#0b0b19]", className)}>
      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Floating stats panel */}
      <MapboxFloatingPanel
        totalUsers={users.length}
        referrerBreakdown={referrerBreakdown}
        countryBreakdown={countryBreakdown}
        deviceBreakdown={deviceBreakdown}
      />

      {/* Activity feed */}
      <div className="absolute bottom-4 left-4 right-4 max-w-md">
        <LiveActivityFeed 
          events={events} 
          onUserClick={handleActivityClick}
          compact
        />
      </div>

      {/* User tooltip */}
      {selectedUser && tooltipPosition && (
        <MapboxTooltipCard
          user={selectedUser}
          position={tooltipPosition}
          onClose={handleCloseTooltip}
        />
      )}

      {/* CSS for markers */}
      <style>{`
        .mapbox-user-marker {
          cursor: pointer;
        }
        
        .marker-container {
          position: relative;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .marker-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 3px solid white;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.4);
          transition: transform 0.2s;
          background: white;
          z-index: 2;
        }
        
        .marker-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .marker-avatar:hover {
          transform: scale(1.2);
        }
        
        .marker-pulse {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.4);
          animation: marker-pulse 2s ease-out infinite;
          z-index: 1;
        }
        
        .marker-container.high-value .marker-pulse {
          background: rgba(34, 197, 94, 0.4);
        }
        
        .marker-container.high-value .marker-avatar {
          border-color: rgb(34, 197, 94);
        }
        
        @keyframes marker-pulse {
          0% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
        
        .mapboxgl-ctrl-logo,
        .mapboxgl-ctrl-attrib {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
