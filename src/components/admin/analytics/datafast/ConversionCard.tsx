import { useState } from "react";
import { AnalyticsCard } from "./AnalyticsCard";
import { AnalyticsTooltip } from "./AnalyticsTooltip";
import { ArrowRight, User, Building2, Clock, MapPin, Monitor, Smartphone, Globe, Check, FileText, Link2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityDots } from "./ActivityDots";
import { UserDetailPanel } from "./UserDetailPanel";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, formatDistanceToNow } from "date-fns";

interface FunnelStage {
  name: string;
  count: number;
  dropoff: number;
}

interface TopUser {
  id: string;
  name: string;
  company: string;
  sessions: number;
  pagesViewed: number;
  connections: number;
  country?: string;
  device?: string;
  lastSeen?: string;
  source?: string;
  timeToConvert?: number;
  activityDays?: Array<{ date: string; pageViews: number; level: 'none' | 'low' | 'medium' | 'high' }>;
}

interface ConversionCardProps {
  funnel: {
    stages: FunnelStage[];
    overallConversion: number;
  };
  topUsers: TopUser[];
}

// Goals milestone definitions
const GOAL_MILESTONES = [
  { id: 'viewed_marketplace', name: 'Viewed Marketplace', icon: Globe },
  { id: 'registered', name: 'Registered Account', icon: User },
  { id: 'nda_signed', name: 'Signed NDA', icon: FileText },
  { id: 'fee_agreement', name: 'Signed Fee Agreement', icon: FileText },
  { id: 'connection', name: 'Sent Connection', icon: Link2 },
];

const JOURNEY_GOALS = [
  { value: 'connection_request', label: 'Connection Request' },
  { value: 'nda_signed', label: 'NDA Signed' },
  { value: 'fee_agreement_signed', label: 'Fee Agreement Signed' },
  { value: 'viewed_listing', label: 'Viewed Listing' },
  { value: 'registration', label: 'Registration' },
];

const COUNTRY_FLAGS: Record<string, string> = {
  'United States': '🇺🇸',
  'United Kingdom': '🇬🇧',
  'Canada': '🇨🇦',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Hungary': '🇭🇺',
  'Netherlands': '🇳🇱',
  'Unknown': '🌍',
};

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] || '🌍';
}

function formatTimeToConvert(seconds: number | undefined): string {
  if (!seconds) return 'N/A';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hrs`;
  return `${Math.floor(seconds / 86400)} days`;
}

// Enhanced Funnel Visualization
function FunnelVisualization({ stages, overallConversion }: { stages: FunnelStage[]; overallConversion: number }) {
  const maxCount = Math.max(...stages.map(s => s.count), 1);
  
  return (
    <div className="space-y-4">
      {/* Overall conversion badge */}
      <div className="flex justify-end">
        <div className="px-3 py-1.5 bg-[hsl(12_95%_77%)/0.1] rounded-full">
          <span className="text-sm font-medium text-[hsl(12_95%_60%)]">
            {overallConversion.toFixed(2)}% overall conversion
          </span>
        </div>
      </div>
      
      {/* Funnel bars */}
      <div className="flex items-end gap-3">
        {stages.map((stage, index) => {
          const widthPercent = (stage.count / maxCount) * 100;
          const isLast = index === stages.length - 1;
          
          return (
            <div key={stage.name} className="flex-1 space-y-2">
              <AnalyticsTooltip
                title={stage.name}
                rows={[
                  { label: 'Count', value: stage.count.toLocaleString() },
                  { label: 'Drop-off', value: `${stage.dropoff > 0 ? '-' : ''}${stage.dropoff.toFixed(0)}%` },
                  { label: 'Conv. from start', value: `${maxCount > 0 ? ((stage.count / maxCount) * 100).toFixed(1) : 0}%`, highlight: true },
                ]}
                topSources={[
                  { name: 'Direct', percentage: 45 },
                  { name: 'Google', percentage: 28 },
                  { name: 'LinkedIn', percentage: 15 },
                ]}
                topCountries={[
                  { name: 'United States', percentage: 42 },
                  { name: 'United Kingdom', percentage: 18 },
                  { name: 'Canada', percentage: 12 },
                ]}
              >
                <div 
                  className="relative cursor-pointer group"
                  style={{ height: `${Math.max(widthPercent * 1.5, 40)}px` }}
                >
                  <div 
                    className={cn(
                      "absolute inset-0 rounded-lg transition-all group-hover:opacity-80",
                      isLast 
                        ? "bg-gradient-to-t from-[hsl(145_60%_45%)] to-[hsl(145_60%_55%)]"
                        : "bg-gradient-to-t from-[hsl(12_95%_70%)] to-[hsl(12_95%_77%)]"
                    )}
                  />
                </div>
              </AnalyticsTooltip>
              
              <div className="text-center space-y-1">
                <div className="text-lg font-medium tabular-nums">
                  {stage.count.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {stage.name}
                </div>
                {stage.dropoff > 0 && (
                  <div className="text-xs text-red-500 tabular-nums">
                    -{stage.dropoff.toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Flow arrows */}
      <div className="flex justify-center gap-8 pt-2">
        {stages.slice(0, -1).map((_, i) => (
          <ArrowRight key={i} className="h-4 w-4 text-muted-foreground" />
        ))}
      </div>
    </div>
  );
}

// Goals tab content
function GoalsTab({ funnel }: { funnel: { stages: FunnelStage[] } }) {
  // Calculate goal completions based on funnel data
  const goals = funnel.stages.map((stage, index) => {
    const prevCount = index > 0 ? funnel.stages[index - 1].count : stage.count;
    const conversionRate = prevCount > 0 ? (stage.count / prevCount) * 100 : 0;
    return {
      name: stage.name,
      count: stage.count,
      conversionRate,
      icon: GOAL_MILESTONES[index]?.icon || Check,
    };
  });

  return (
    <div className="space-y-2">
      {goals.map((goal, index) => (
        <div 
          key={goal.name}
          className="flex items-center justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              index === goals.length - 1 
                ? "bg-[hsl(145_60%_90%)] text-[hsl(145_60%_40%)]" 
                : "bg-muted text-muted-foreground"
            )}>
              <goal.icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">{goal.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm tabular-nums font-medium">{goal.count.toLocaleString()}</span>
            <Badge variant="outline" className="tabular-nums text-xs">
              {goal.conversionRate.toFixed(1)}%
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// Users tab content with rich detail
function UsersTab({ users, onUserClick }: { users: TopUser[]; onUserClick: (id: string) => void }) {
  if (users.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No user activity data yet
      </div>
    );
  }
  
  return (
    <div className="space-y-1">
      {users.slice(0, 8).map((user) => (
        <div
          key={user.id}
          onClick={() => onUserClick(user.id)}
          className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors group"
        >
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[hsl(12_95%_77%)] to-[hsl(12_95%_60%)] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{user.name}</span>
                {user.country && (
                  <span className="text-sm">{getFlag(user.country)}</span>
                )}
              </div>
              {user.company && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate max-w-[150px]">{user.company}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Device icon */}
            <div className="text-muted-foreground">
              {user.device === 'Mobile' ? (
                <Smartphone className="h-3.5 w-3.5" />
              ) : (
                <Monitor className="h-3.5 w-3.5" />
              )}
            </div>
            
            {/* Activity dots */}
            {user.activityDays && (
              <ActivityDots days={user.activityDays} />
            )}
            
            {/* Stats */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium tabular-nums">{user.sessions}</div>
                <div className="text-[10px] text-muted-foreground uppercase">sessions</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium tabular-nums text-[hsl(12_95%_60%)]">{user.connections}</div>
                <div className="text-[10px] text-muted-foreground uppercase">connections</div>
              </div>
            </div>
            
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Journey tab with goal filtering
function JourneyTab({ users, onUserClick }: { users: TopUser[]; onUserClick: (id: string) => void }) {
  const [selectedGoal, setSelectedGoal] = useState('connection_request');
  
  // Filter users who completed the selected goal
  const filteredUsers = users.filter(u => {
    if (selectedGoal === 'connection_request') return u.connections > 0;
    return true; // For demo, show all users
  });

  return (
    <div className="space-y-4">
      {/* Goal selector */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Journey to:
        </div>
        <Select value={selectedGoal} onValueChange={setSelectedGoal}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JOURNEY_GOALS.map((goal) => (
              <SelectItem key={goal.value} value={goal.value} className="text-xs">
                {goal.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Journey table */}
      <div className="space-y-1">
        {filteredUsers.slice(0, 6).map((user) => (
          <div
            key={user.id}
            onClick={() => onUserClick(user.id)}
            className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(12_95%_77%)] to-[hsl(12_95%_60%)] flex items-center justify-center text-white text-xs font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{user.name}</span>
                  {user.country && <span className="text-sm">{getFlag(user.country)}</span>}
                </div>
                {user.source && (
                  <div className="text-xs text-muted-foreground">via {user.source}</div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Time to complete */}
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm font-medium tabular-nums">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {formatTimeToConvert(user.timeToConvert)}
                </div>
                <div className="text-[10px] text-muted-foreground">time to complete</div>
              </div>
              
              {/* Activity dots */}
              {user.activityDays && (
                <ActivityDots days={user.activityDays} />
              )}
              
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
        
        {filteredUsers.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            No users completed this goal yet
          </div>
        )}
      </div>
    </div>
  );
}

export function ConversionCard({ funnel, topUsers }: ConversionCardProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  const tabs = [
    { id: 'goals', label: 'Goals' },
    { id: 'funnel', label: 'Funnel' },
    { id: 'users', label: 'Users' },
    { id: 'journey', label: 'Journey' },
  ];

  return (
    <>
      <AnalyticsCard
        tabs={tabs}
        defaultTab="funnel"
        className="col-span-full"
      >
        {(activeTab) => (
          <div>
            {activeTab === 'goals' && (
              <GoalsTab funnel={funnel} />
            )}
            
            {activeTab === 'funnel' && (
              <FunnelVisualization stages={funnel.stages} overallConversion={funnel.overallConversion} />
            )}
            
            {activeTab === 'users' && (
              <UsersTab users={topUsers} onUserClick={setSelectedUserId} />
            )}
            
            {activeTab === 'journey' && (
              <JourneyTab users={topUsers} onUserClick={setSelectedUserId} />
            )}
          </div>
        )}
      </AnalyticsCard>
      
      {/* User Detail Panel */}
      <UserDetailPanel 
        userId={selectedUserId} 
        open={!!selectedUserId} 
        onClose={() => setSelectedUserId(null)} 
      />
    </>
  );
}
