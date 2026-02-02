import { useState } from "react";
import { AnalyticsCard, SortToggle } from "./AnalyticsCard";
import { AnalyticsTooltip } from "./AnalyticsTooltip";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { 
  Sparkles, 
  Users, 
  Search, 
  Globe, 
  Link2, 
  CreditCard, 
  Mail,
  ExternalLink 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProportionalBar } from "./ProportionalBar";
import { ReferrerLogo, formatReferrerName } from "./ReferrerLogo";

interface SourcesCardProps {
  channels: Array<{ name: string; visitors: number; connections: number; icon: string }>;
  referrers: Array<{ domain: string; visitors: number; connections: number; favicon: string }>;
  campaigns: Array<{ name: string; visitors: number; connections: number }>;
  keywords: Array<{ term: string; visitors: number; connections: number }>;
}

const CHANNEL_COLORS: Record<string, string> = {
  'AI': 'hsl(280 70% 55%)',
  'Organic Social': 'hsl(200 70% 55%)',
  'Organic Search': 'hsl(145 60% 45%)',
  'Direct': 'hsl(220 15% 60%)',
  'Referral': 'hsl(35 90% 55%)',
  'Paid': 'hsl(12 95% 65%)',
  'Newsletter': 'hsl(340 75% 55%)',
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  'AI': <Sparkles className="h-3.5 w-3.5" />,
  'Organic Social': <Users className="h-3.5 w-3.5" />,
  'Organic Search': <Search className="h-3.5 w-3.5" />,
  'Direct': <Globe className="h-3.5 w-3.5" />,
  'Referral': <Link2 className="h-3.5 w-3.5" />,
  'Paid': <CreditCard className="h-3.5 w-3.5" />,
  'Newsletter': <Mail className="h-3.5 w-3.5" />,
};

export function SourcesCard({ channels, referrers, campaigns, keywords }: SourcesCardProps) {
  const [sortBy, setSortBy] = useState<'visitors' | 'connections'>('visitors');
  
  const tabs = [
    { id: 'channel', label: 'Channel' },
    { id: 'referrer', label: 'Referrer' },
    { id: 'campaign', label: 'Campaign' },
    { id: 'keyword', label: 'Keyword' },
  ];

  // Sort all data by sortBy
  const sortedChannels = [...channels].sort((a, b) => 
    sortBy === 'visitors' ? b.visitors - a.visitors : b.connections - a.connections
  );
  
  const sortedReferrers = [...referrers].sort((a, b) => 
    sortBy === 'visitors' ? b.visitors - a.visitors : b.connections - a.connections
  );
  
  const sortedCampaigns = [...campaigns].sort((a, b) => 
    sortBy === 'visitors' ? b.visitors - a.visitors : b.connections - a.connections
  );
  
  const sortedKeywords = [...keywords].sort((a, b) => 
    sortBy === 'visitors' ? b.visitors - a.visitors : b.connections - a.connections
  );
  
  const totalVisitors = channels.reduce((sum, c) => sum + c.visitors, 0);
  const totalConnections = channels.reduce((sum, c) => sum + c.connections, 0);
  const maxReferrerVisitors = Math.max(...referrers.map(r => r.visitors), 1);
  const maxReferrerConnections = Math.max(...referrers.map(r => r.connections), 1);
  const maxCampaignVisitors = Math.max(...campaigns.map(c => c.visitors), 1);
  const maxCampaignConnections = Math.max(...campaigns.map(c => c.connections), 1);
  const maxKeywordVisitors = Math.max(...keywords.map(k => k.visitors), 1);
  const maxKeywordConnections = Math.max(...keywords.map(k => k.connections), 1);

  return (
    <AnalyticsCard
      tabs={tabs}
      defaultTab="channel"
      rightAction={<SortToggle value={sortBy} onChange={setSortBy} />}
    >
      {(activeTab) => (
        <div className="space-y-4">
          {activeTab === 'channel' && (
            <div className="flex gap-6">
              {/* Donut Chart */}
              <div className="w-32 h-32 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sortedChannels}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      dataKey={sortBy}
                      paddingAngle={2}
                    >
                      {sortedChannels.map((entry, index) => (
                        <Cell 
                          key={entry.name} 
                          fill={CHANNEL_COLORS[entry.name] || 'hsl(220 15% 60%)'} 
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* Legend List */}
              <div className="flex-1 space-y-1">
                {sortedChannels.slice(0, 6).map((channel) => {
                  const total = sortBy === 'visitors' ? totalVisitors : totalConnections;
                  const percentage = total > 0 
                    ? ((channel[sortBy] / total) * 100).toFixed(0)
                    : '0';
                  
                  return (
                    <AnalyticsTooltip
                      key={channel.name}
                      title={channel.name}
                      rows={[
                        { label: 'Visitors', value: channel.visitors.toLocaleString() },
                        { label: 'Connections', value: channel.connections },
                        { label: 'Conv. Rate', value: `${channel.visitors > 0 ? ((channel.connections / channel.visitors) * 100).toFixed(1) : 0}%`, highlight: true },
                      ]}
                    >
                      <div className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: CHANNEL_COLORS[channel.name] || 'hsl(220 15% 60%)' }}
                          />
                          <span className="text-muted-foreground">
                            {CHANNEL_ICONS[channel.name]}
                          </span>
                          <span className="text-sm">{channel.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {percentage}%
                          </span>
                          <span className="text-sm font-medium tabular-nums w-12 text-right">
                            {channel[sortBy].toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </AnalyticsTooltip>
                  );
                })}
              </div>
            </div>
          )}
          
          {activeTab === 'referrer' && (
            <div className="space-y-1">
              {sortedReferrers.slice(0, 8).map((ref) => (
                <AnalyticsTooltip
                  key={ref.domain}
                  title={formatReferrerName(ref.domain)}
                  rows={[
                    { label: 'Visitors', value: ref.visitors.toLocaleString() },
                    { label: 'Connections', value: ref.connections },
                    { label: 'Conv. Rate', value: `${ref.visitors > 0 ? ((ref.connections / ref.visitors) * 100).toFixed(1) : 0}%`, highlight: true },
                  ]}
                >
                  <ProportionalBar 
                    value={sortBy === 'visitors' ? ref.visitors : ref.connections} 
                    maxValue={sortBy === 'visitors' ? maxReferrerVisitors : maxReferrerConnections}
                    secondaryValue={ref.connections}
                    secondaryMaxValue={maxReferrerConnections}
                  >
                    <div className="flex items-center justify-between cursor-pointer group">
                      <div className="flex items-center gap-2.5">
                        <ReferrerLogo domain={ref.domain} className="w-4 h-4" />
                        <span className="text-sm font-medium truncate max-w-[180px]">
                          {formatReferrerName(ref.domain)}
                        </span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex items-center gap-3">
                        {ref.connections > 0 && (
                          <span className="text-xs text-[hsl(12_95%_60%)] font-medium tabular-nums">
                            {ref.connections} conv
                          </span>
                        )}
                        <span className="text-sm font-medium tabular-nums w-10 text-right">
                          {ref[sortBy === 'visitors' ? 'visitors' : 'connections'].toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </ProportionalBar>
                </AnalyticsTooltip>
              ))}
              {referrers.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No referrer data</div>
              )}
            </div>
          )}
          
          {activeTab === 'campaign' && (
            <div className="space-y-1">
              {sortedCampaigns.slice(0, 8).map((campaign) => (
                <AnalyticsTooltip
                  key={campaign.name}
                  title={campaign.name}
                  rows={[
                    { label: 'Visitors', value: campaign.visitors.toLocaleString() },
                    { label: 'Connections', value: campaign.connections },
                    { label: 'Conv. Rate', value: `${campaign.visitors > 0 ? ((campaign.connections / campaign.visitors) * 100).toFixed(1) : 0}%`, highlight: true },
                  ]}
                >
                  <ProportionalBar 
                    value={sortBy === 'visitors' ? campaign.visitors : campaign.connections} 
                    maxValue={sortBy === 'visitors' ? maxCampaignVisitors : maxCampaignConnections}
                  >
                    <div className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm font-medium truncate max-w-[200px]">{campaign.name}</span>
                      <div className="flex items-center gap-3">
                        {campaign.connections > 0 && (
                          <span className="text-xs text-[hsl(12_95%_60%)] font-medium tabular-nums">
                            {campaign.connections} conv
                          </span>
                        )}
                        <span className="text-sm font-medium tabular-nums">
                          {campaign[sortBy].toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </ProportionalBar>
                </AnalyticsTooltip>
              ))}
              {campaigns.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No campaign data</div>
              )}
            </div>
          )}
          
          {activeTab === 'keyword' && (
            <div className="space-y-1">
              {sortedKeywords.slice(0, 8).map((kw) => (
                <AnalyticsTooltip
                  key={kw.term}
                  title={kw.term}
                  rows={[
                    { label: 'Visitors', value: kw.visitors.toLocaleString() },
                    { label: 'Connections', value: kw.connections },
                    { label: 'Conv. Rate', value: `${kw.visitors > 0 ? ((kw.connections / kw.visitors) * 100).toFixed(1) : 0}%`, highlight: true },
                  ]}
                >
                  <ProportionalBar 
                    value={sortBy === 'visitors' ? kw.visitors : kw.connections} 
                    maxValue={sortBy === 'visitors' ? maxKeywordVisitors : maxKeywordConnections}
                  >
                    <div className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm font-medium truncate max-w-[200px]">{kw.term}</span>
                      <div className="flex items-center gap-3">
                        {kw.connections > 0 && (
                          <span className="text-xs text-[hsl(12_95%_60%)] font-medium tabular-nums">
                            {kw.connections} conv
                          </span>
                        )}
                        <span className="text-sm font-medium tabular-nums">
                          {kw[sortBy].toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </ProportionalBar>
                </AnalyticsTooltip>
              ))}
              {keywords.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No keyword data</div>
              )}
            </div>
          )}
        </div>
      )}
    </AnalyticsCard>
  );
}
