import { useState } from "react";
import { AnalyticsCard, SortToggle, SortValue } from "./AnalyticsCard";
import { AnalyticsTooltip } from "./AnalyticsTooltip";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrowserLogo, OSLogo } from "./BrowserLogo";
import { ProportionalBar } from "./ProportionalBar";
import { useAnalyticsFilters } from "@/contexts/AnalyticsFiltersContext";
import { FilterModal } from "./FilterModal";

interface TechStackCardProps {
  browsers: Array<{ name: string; visitors: number; signups: number; percentage: number }>;
  operatingSystems: Array<{ name: string; visitors: number; signups: number; percentage: number }>;
  devices: Array<{ type: string; visitors: number; signups: number; percentage: number }>;
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  'Desktop': <Monitor className="h-4 w-4" />,
  'Mobile': <Smartphone className="h-4 w-4" />,
  'Tablet': <Tablet className="h-4 w-4" />,
};

export function TechStackCard({ browsers, operatingSystems, devices }: TechStackCardProps) {
  const [sortBy, setSortBy] = useState<SortValue>('visitors');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<string>('');
  const { hasFilter } = useAnalyticsFilters();
  
  const tabs = [
    { id: 'browser', label: 'Browser' },
    { id: 'os', label: 'OS' },
    { id: 'device', label: 'Device' },
  ];

  const getSortValue = (item: { visitors?: number; signups?: number }) => {
    if (sortBy === 'visitors') return item.visitors || 0;
    if (sortBy === 'signups') return item.signups || 0;
    return item.visitors || 0;
  };

  const sortedBrowsers = [...browsers].sort((a, b) => getSortValue(b) - getSortValue(a));
  const sortedOS = [...operatingSystems].sort((a, b) => getSortValue(b) - getSortValue(a));
  const sortedDevices = [...devices].sort((a, b) => getSortValue(b) - getSortValue(a));

  const maxBrowserValue = Math.max(...browsers.map(b => getSortValue(b)), 1);
  const maxOSValue = Math.max(...operatingSystems.map(os => getSortValue(os)), 1);
  const maxDeviceValue = Math.max(...devices.map(d => getSortValue(d)), 1);

  // Removed - filtering now only via Details modal

  const handleDetailsClick = (activeTab: string) => {
    setModalTab(activeTab);
    setModalOpen(true);
  };

  const getModalItems = () => {
    switch (modalTab) {
      case 'browser':
        return browsers.map(b => ({
          id: b.name,
          label: b.name,
          visitors: b.visitors,
          signups: b.signups,
        }));
      case 'os':
        return operatingSystems.map(os => ({
          id: os.name,
          label: os.name,
          visitors: os.visitors,
          signups: os.signups,
        }));
      case 'device':
        return devices.map(d => ({
          id: d.type,
          label: d.type,
          visitors: d.visitors,
          signups: d.signups,
        }));
      default:
        return [];
    }
  };

  const getFilterType = (): 'browser' | 'os' | 'device' => {
    return modalTab as 'browser' | 'os' | 'device';
  };

  const getModalTitle = () => {
    switch (modalTab) {
      case 'browser': return 'Browsers';
      case 'os': return 'Operating Systems';
      case 'device': return 'Devices';
      default: return 'Details';
    }
  };

  return (
    <>
      <AnalyticsCard
        tabs={tabs}
        defaultTab="browser"
        rightAction={<SortToggle value={sortBy} onChange={setSortBy} />}
        onDetailsClick={handleDetailsClick}
      >
        {(activeTab) => (
          <div className="space-y-1">
            {activeTab === 'browser' && (
              <>
                {sortedBrowsers.slice(0, 6).map((browser, i) => {
                  const isActive = hasFilter('browser', browser.name);
                  return (
                    <AnalyticsTooltip
                      key={`${browser.name}-${i}`}
                      title={browser.name}
                      rows={[
                        { label: 'Visitors', value: browser.visitors.toLocaleString() },
                        { label: 'Signups', value: browser.signups || 0 },
                        { label: 'Share', value: `${browser.percentage.toFixed(1)}%`, highlight: true },
                      ]}
                    >
                      <ProportionalBar value={getSortValue(browser)} maxValue={maxBrowserValue}>
                        <div 
                          className={cn(
                            "flex items-center justify-between",
                            isActive && "opacity-50"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <BrowserLogo browser={browser.name} className="h-5 w-5" />
                            <span className="text-sm font-medium">{browser.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {browser.percentage.toFixed(0)}%
                            </span>
                            <span className="text-sm font-medium tabular-nums w-12 text-right">
                              {getSortValue(browser).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </ProportionalBar>
                    </AnalyticsTooltip>
                  );
                })}
                {browsers.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No browser data</div>
                )}
              </>
            )}
            
            {activeTab === 'os' && (
              <>
                {sortedOS.slice(0, 6).map((os, i) => {
                  const isActive = hasFilter('os', os.name);
                  return (
                    <AnalyticsTooltip
                      key={`${os.name}-${i}`}
                      title={os.name}
                      rows={[
                        { label: 'Visitors', value: os.visitors.toLocaleString() },
                        { label: 'Signups', value: os.signups || 0 },
                        { label: 'Share', value: `${os.percentage.toFixed(1)}%`, highlight: true },
                      ]}
                    >
                      <ProportionalBar value={getSortValue(os)} maxValue={maxOSValue}>
                        <div 
                          className={cn(
                            "flex items-center justify-between",
                            isActive && "opacity-50"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <OSLogo os={os.name} className="h-5 w-5" />
                            <span className="text-sm font-medium">{os.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {os.percentage.toFixed(0)}%
                            </span>
                            <span className="text-sm font-medium tabular-nums w-12 text-right">
                              {getSortValue(os).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </ProportionalBar>
                    </AnalyticsTooltip>
                  );
                })}
                {operatingSystems.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No OS data</div>
                )}
              </>
            )}
            
            {activeTab === 'device' && (
              <>
                {sortedDevices.map((device, i) => {
                  const isActive = hasFilter('device', device.type);
                  return (
                    <AnalyticsTooltip
                      key={`${device.type}-${i}`}
                      title={device.type}
                      rows={[
                        { label: 'Visitors', value: device.visitors.toLocaleString() },
                        { label: 'Signups', value: device.signups || 0 },
                        { label: 'Share', value: `${device.percentage.toFixed(1)}%`, highlight: true },
                      ]}
                    >
                      <ProportionalBar value={getSortValue(device)} maxValue={maxDeviceValue}>
                        <div 
                          className={cn(
                            "flex items-center justify-between",
                            isActive && "opacity-50"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-muted-foreground">
                              {DEVICE_ICONS[device.type] || <Monitor className="h-4 w-4" />}
                            </span>
                            <span className="text-sm font-medium">{device.type}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {device.percentage.toFixed(0)}%
                            </span>
                            <span className="text-sm font-medium tabular-nums w-12 text-right">
                              {getSortValue(device).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </ProportionalBar>
                    </AnalyticsTooltip>
                  );
                })}
                {devices.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No device data</div>
                )}
              </>
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
