import { useState, useMemo } from "react";
import { AnalyticsCard, SortToggle, SortValue } from "./AnalyticsCard";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProportionalBar } from "./ProportionalBar";
import { ReferrerLogo, formatReferrerName } from "./ReferrerLogo";
import { useAnalyticsFilters } from "@/contexts/AnalyticsFiltersContext";
import { FilterModal } from "./FilterModal";

interface SourcesCardProps {
  channels: Array<{ name: string; visitors: number; signups: number; connections: number; icon: string }>;
  referrers: Array<{ domain: string; visitors: number; signups: number; connections: number; favicon: string }>;
  campaigns: Array<{ name: string; visitors: number; signups: number; connections: number }>;
  keywords: Array<{ term: string; visitors: number; signups: number; connections: number }>;
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
  const [sortBy, setSortBy] = useState<SortValue>('visitors');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<string>('');
  const { hasFilter } = useAnalyticsFilters();
  
  const tabs = [
    { id: 'channel', label: 'Channel' },
    { id: 'referrer', label: 'Referrer' },
    { id: 'campaign', label: 'Campaign' },
    { id: 'keyword', label: 'Keyword' },
  ];

  const getSortValue = (item: { visitors?: number; signups?: number; connections?: number }) => {
    if (sortBy === 'visitors') return item.visitors || 0;
    if (sortBy === 'signups') return item.signups || 0;
    return item.connections || 0;
  };

  const sortedChannels = [...channels].sort((a, b) => getSortValue(b) - getSortValue(a));
  const sortedReferrers = [...referrers].sort((a, b) => getSortValue(b) - getSortValue(a));
  const sortedCampaigns = [...campaigns].sort((a, b) => getSortValue(b) - getSortValue(a));
  const sortedKeywords = [...keywords].sort((a, b) => getSortValue(b) - getSortValue(a));
  
  const totalVisitors = channels.reduce((sum, c) => sum + c.visitors, 0);
  const totalSignups = channels.reduce((sum, c) => sum + (c.signups || 0), 0);
  const totalConnections = channels.reduce((sum, c) => sum + c.connections, 0);
  
  const getTotal = () => {
    if (sortBy === 'visitors') return totalVisitors;
    if (sortBy === 'signups') return totalSignups;
    return totalConnections;
  };

  const maxReferrerValue = Math.max(...referrers.map(r => getSortValue(r)), 1);
  const maxCampaignValue = Math.max(...campaigns.map(c => getSortValue(c)), 1);
  const maxKeywordValue = Math.max(...keywords.map(k => getSortValue(k)), 1);

  // Removed - filtering now only via Details modal

  const handleDetailsClick = (activeTab: string) => {
    setModalTab(activeTab);
    setModalOpen(true);
  };

  // Modal items based on active tab
  const getModalItems = () => {
    switch (modalTab) {
      case 'channel':
        return channels.map(c => ({
          id: c.name,
          label: c.name,
          visitors: c.visitors,
          signups: c.signups,
          connections: c.connections,
        }));
      case 'referrer':
        return referrers.map(r => ({
          id: r.domain,
          label: formatReferrerName(r.domain),
          visitors: r.visitors,
          signups: r.signups,
          connections: r.connections,
          icon: r.favicon,
        }));
      case 'campaign':
        return campaigns.map(c => ({
          id: c.name,
          label: c.name,
          visitors: c.visitors,
          signups: c.signups,
          connections: c.connections,
        }));
      case 'keyword':
        return keywords.map(k => ({
          id: k.term,
          label: k.term,
          visitors: k.visitors,
          signups: k.signups,
          connections: k.connections,
        }));
      default:
        return [];
    }
  };

  const getFilterType = (): 'channel' | 'referrer' | 'campaign' | 'keyword' => {
    return modalTab as 'channel' | 'referrer' | 'campaign' | 'keyword';
  };

  const getModalTitle = () => {
    switch (modalTab) {
      case 'channel': return 'Channels';
      case 'referrer': return 'Referrers';
      case 'campaign': return 'Campaigns';
      case 'keyword': return 'Keywords';
      default: return 'Details';
    }
  };

  return (
    <>
      <AnalyticsCard
        tabs={tabs}
        defaultTab="channel"
        rightAction={<SortToggle value={sortBy} onChange={setSortBy} />}
        onDetailsClick={handleDetailsClick}
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
                        dataKey={sortBy === 'signups' ? 'signups' : sortBy}
                        paddingAngle={2}
                      >
                        {sortedChannels.map((entry) => (
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
                  {sortedChannels.map((channel) => {
                    const total = getTotal();
                    const value = getSortValue(channel);
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(0) : '0';
                    const isActive = hasFilter('channel', channel.name);
                    
                    return (
                      <AnalyticsTooltip
                        key={channel.name}
                        title={channel.name}
                        rows={[
                          { label: 'Visitors', value: channel.visitors.toLocaleString() },
                          { label: 'Signups', value: channel.signups || 0 },
                          { label: 'Connections', value: channel.connections },
                          { label: 'Conv. Rate', value: `${channel.visitors > 0 ? ((channel.connections / channel.visitors) * 100).toFixed(1) : 0}%`, highlight: true },
                        ]}
                      >
                        <div 
                          className={cn(
                            "flex items-center justify-between py-1.5 hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors",
                            isActive && "opacity-50"
                          )}
                        >
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
                              {value.toLocaleString()}
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
                {sortedReferrers.slice(0, 8).map((ref) => {
                  const isActive = hasFilter('referrer', ref.domain);
                  return (
                    <AnalyticsTooltip
                      key={ref.domain}
                      title={formatReferrerName(ref.domain)}
                      rows={[
                        { label: 'Visitors', value: ref.visitors.toLocaleString() },
                        { label: 'Signups', value: ref.signups || 0 },
                        { label: 'Connections', value: ref.connections },
                        { label: 'Conv. Rate', value: `${ref.visitors > 0 ? ((ref.connections / ref.visitors) * 100).toFixed(1) : 0}%`, highlight: true },
                      ]}
                    >
                      <ProportionalBar 
                        value={getSortValue(ref)} 
                        maxValue={maxReferrerValue}
                        secondaryValue={ref.connections}
                        secondaryMaxValue={Math.max(...referrers.map(r => r.connections), 1)}
                      >
                        <div 
                          className={cn(
                            "flex items-center justify-between",
                            isActive && "opacity-50"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <ReferrerLogo domain={ref.domain} className="w-4 h-4" />
                            <span className="text-sm font-medium truncate max-w-[180px]">
                              {formatReferrerName(ref.domain)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {ref.connections > 0 && (
                              <span className="text-xs text-[hsl(12_95%_60%)] font-medium tabular-nums">
                                {ref.connections} conv
                              </span>
                            )}
                            <span className="text-sm font-medium tabular-nums w-10 text-right">
                              {getSortValue(ref).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </ProportionalBar>
                    </AnalyticsTooltip>
                  );
                })}
                {referrers.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No referrer data</div>
                )}
              </div>
            )}
            
            {activeTab === 'campaign' && (
              <div className="space-y-1">
                {sortedCampaigns.slice(0, 8).map((campaign) => {
                  const isActive = hasFilter('campaign', campaign.name);
                  return (
                    <AnalyticsTooltip
                      key={campaign.name}
                      title={campaign.name}
                      rows={[
                        { label: 'Visitors', value: campaign.visitors.toLocaleString() },
                        { label: 'Signups', value: campaign.signups || 0 },
                        { label: 'Connections', value: campaign.connections },
                        { label: 'Conv. Rate', value: `${campaign.visitors > 0 ? ((campaign.connections / campaign.visitors) * 100).toFixed(1) : 0}%`, highlight: true },
                      ]}
                    >
                      <ProportionalBar 
                        value={getSortValue(campaign)} 
                        maxValue={maxCampaignValue}
                      >
                        <div 
                          className={cn(
                            "flex items-center justify-between",
                            isActive && "opacity-50"
                          )}
                        >
                          <span className="text-sm font-medium truncate max-w-[200px]">{campaign.name}</span>
                          <div className="flex items-center gap-3">
                            {campaign.connections > 0 && (
                              <span className="text-xs text-[hsl(12_95%_60%)] font-medium tabular-nums">
                                {campaign.connections} conv
                              </span>
                            )}
                            <span className="text-sm font-medium tabular-nums">
                              {getSortValue(campaign).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </ProportionalBar>
                    </AnalyticsTooltip>
                  );
                })}
                {campaigns.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No campaign data</div>
                )}
              </div>
            )}
            
            {activeTab === 'keyword' && (
              <div className="space-y-1">
                {sortedKeywords.slice(0, 8).map((kw) => {
                  const isActive = hasFilter('keyword', kw.term);
                  return (
                    <AnalyticsTooltip
                      key={kw.term}
                      title={kw.term}
                      rows={[
                        { label: 'Visitors', value: kw.visitors.toLocaleString() },
                        { label: 'Signups', value: kw.signups || 0 },
                        { label: 'Connections', value: kw.connections },
                        { label: 'Conv. Rate', value: `${kw.visitors > 0 ? ((kw.connections / kw.visitors) * 100).toFixed(1) : 0}%`, highlight: true },
                      ]}
                    >
                      <ProportionalBar 
                        value={getSortValue(kw)} 
                        maxValue={maxKeywordValue}
                      >
                        <div 
                          className={cn(
                            "flex items-center justify-between",
                            isActive && "opacity-50"
                          )}
                        >
                          <span className="text-sm font-medium truncate max-w-[200px]">{kw.term}</span>
                          <div className="flex items-center gap-3">
                            {kw.connections > 0 && (
                              <span className="text-xs text-[hsl(12_95%_60%)] font-medium tabular-nums">
                                {kw.connections} conv
                              </span>
                            )}
                            <span className="text-sm font-medium tabular-nums">
                              {getSortValue(kw).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </ProportionalBar>
                    </AnalyticsTooltip>
                  );
                })}
                {keywords.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No keyword data</div>
                )}
              </div>
            )}
          </div>
        )}
      </AnalyticsCard>

      <FilterModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={getModalTitle()}
        filterType={getFilterType()}
        items={getModalItems()}
        sortBy={sortBy}
      />
    </>
  );
}
