import { useState } from "react";
import { AnalyticsCard } from "./AnalyticsCard";
import { AnalyticsTooltip } from "./AnalyticsTooltip";
import { ArrowRight, User, Building2, Clock, Monitor, Smartphone, Globe, Check, FileText, Link2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityDots } from "./ActivityDots";
import { UserDetailPanel } from "./UserDetailPanel";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { BrowserLogo, OSLogo, SourceLogo } from "./BrowserLogo";
import { ProportionalBar } from "./ProportionalBar";

interface FunnelStage {
  name: string;
  count: number;
  dropoff: number;
}

interface TopUser {
  id: string;
  name: string;
  isAnonymous?: boolean;
  company: string;
  sessions: number;
  pagesViewed: number;
  connections: number;
  country?: string;
  city?: string;
  device?: string;
  browser?: string;
  os?: string;
  source?: string;
  referrerDomain?: string;
  lastSeen?: string;
  timeOnSite?: number;
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
  'Australia': '🇦🇺',
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

function formatLastSeen(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 24) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (diffHours < 48) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    } else {
      return formatDistanceToNow(date, { addSuffix: true });
    }
  } catch {
    return '';
  }
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

// Format time on site (seconds to readable format)
function formatTimeOnSite(seconds: number | undefined): string {
  if (!seconds || seconds === 0) return '-';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Get avatar color based on name for anonymous visitors
function getAvatarColor(name: string): string {
  const colors = [
    'from-blue-500 to-blue-600',
    'from-emerald-500 to-emerald-600',
    'from-amber-500 to-amber-600',
    'from-violet-500 to-violet-600',
    'from-rose-500 to-rose-600',
    'from-cyan-500 to-cyan-600',
    'from-orange-500 to-orange-600',
    'from-indigo-500 to-indigo-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return colors[Math.abs(hash) % colors.length];
}

// Enhanced Users tab with full Datafa.st-style data - scrollable with fixed height
function UsersTab({ users, onUserClick }: { users: TopUser[]; onUserClick: (id: string) => void }) {
  if (users.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No user activity data yet
      </div>
    );
  }

  const maxConnections = Math.max(...users.map(u => u.connections), 1);
  const maxSessions = Math.max(...users.map(u => u.sessions), 1);
  
  return (
    <div className="relative">
      {/* Scrollable container with fixed max height - shows all users, not limited to 15 */}
      <div className="max-h-[400px] overflow-y-auto pr-1">
        <div className="space-y-1">
          {/* Header row - sticky at top */}
          <div className="sticky top-0 bg-card z-10 flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/50 mb-2">
            <span className="flex-1">Visitor</span>
            <div className="flex items-center gap-6">
              <span className="w-16 text-center">Source</span>
              <span className="w-12 text-right">Spent</span>
              <span className="w-24 text-right">Last seen</span>
              <span className="w-20 text-right">Activity</span>
            </div>
          </div>
          
          {/* Show all users (up to 50 fetched), not just first 15 */}
          {users.map((user) => (
        <ProportionalBar
          key={user.id}
          value={user.sessions}
          maxValue={maxSessions}
          secondaryValue={user.connections}
          secondaryMaxValue={maxConnections}
          className="cursor-pointer"
        >
          <div
            onClick={() => onUserClick(user.id)}
            className="flex items-center justify-between group"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Avatar with dynamic color for anonymous */}
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 bg-gradient-to-br",
                user.isAnonymous 
                  ? getAvatarColor(user.name)
                  : "from-[hsl(12_95%_77%)] to-[hsl(12_95%_60%)]"
              )}>
                {user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{user.name}</span>
                  {user.connections > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-[hsl(145_60%_90%)] text-[hsl(145_60%_40%)] border-0">
                      {user.connections} {user.connections === 1 ? 'connection' : 'connections'}
                    </Badge>
                  )}
                </div>
                
                {/* Tech stack row with country */}
                <div className="flex items-center gap-2 mt-0.5">
                  {user.country && (
                    <span className="text-xs flex items-center gap-1">
                      <span>{getFlag(user.country)}</span>
                      <span className="text-muted-foreground truncate max-w-[80px]">{user.country}</span>
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {user.device && (
                      user.device === 'Mobile' ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />
                    )}
                    {user.os && <OSLogo os={user.os} className="h-3 w-3 opacity-70" />}
                    {user.browser && <BrowserLogo browser={user.browser} className="h-3 w-3" />}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Source */}
              <div className="w-16 flex items-center justify-center gap-1">
                {user.source && (
                  <>
                    <SourceLogo source={user.source} className="h-3.5 w-3.5" />
                    <span className="text-xs text-muted-foreground truncate max-w-[50px]">
                      {user.source === 'Direct' ? 'Direct' : user.source.split(' ')[0]}
                    </span>
                  </>
                )}
              </div>
              
              {/* Time on site (Spent) */}
              <div className="w-12 text-right">
                <span className="text-sm font-medium tabular-nums text-muted-foreground">
                  {formatTimeOnSite(user.timeOnSite)}
                </span>
              </div>
              
              {/* Last seen */}
              <div className="w-24 text-right">
                <span className="text-xs text-muted-foreground">
                  {formatLastSeen(user.lastSeen)}
                </span>
              </div>
              
              {/* Activity dots */}
              <div className="w-20 flex justify-end">
                {user.activityDays && user.activityDays.length > 0 && (
                  <ActivityDots days={user.activityDays} />
                )}
              </div>
              
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          </ProportionalBar>
          ))}
        </div>
      </div>
    </div>
  );
}

// Journey tab with goal filtering
function JourneyTab({ users, onUserClick }: { users: TopUser[]; onUserClick: (id: string) => void }) {
  const [selectedGoal, setSelectedGoal] = useState('connection_request');
  
  // Filter users who completed the selected goal
  const filteredUsers = users.filter(u => {
    if (selectedGoal === 'connection_request') return u.connections > 0;
    return true;
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
        {filteredUsers.slice(0, 8).map((user) => (
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
                <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                  {user.device && (
                    user.device === 'Mobile' ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />
                  )}
                  {user.browser && <BrowserLogo browser={user.browser} className="h-3 w-3" />}
                  {user.source && (
                    <span className="text-xs ml-1">via {user.source}</span>
                  )}
                </div>
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
        defaultTab="users"
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
