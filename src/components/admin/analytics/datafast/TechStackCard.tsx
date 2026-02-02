import { useState } from "react";
import { AnalyticsCard, SortToggle, SortValue } from "./AnalyticsCard";
import { AnalyticsTooltip } from "./AnalyticsTooltip";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrowserLogo, OSLogo } from "./BrowserLogo";
import { ProportionalBar } from "./ProportionalBar";

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
  
  const tabs = [
    { id: 'browser', label: 'Browser' },
    { id: 'os', label: 'OS' },
    { id: 'device', label: 'Device' },
  ];

  // Get sort value for any item
  const getSortValue = (item: { visitors?: number; signups?: number }) => {
    if (sortBy === 'visitors') return item.visitors || 0;
    if (sortBy === 'signups') return item.signups || 0;
    return item.visitors || 0; // Connections not applicable for tech stack
  };

  const sortedBrowsers = [...browsers].sort((a, b) => getSortValue(b) - getSortValue(a));
  const sortedOS = [...operatingSystems].sort((a, b) => getSortValue(b) - getSortValue(a));
  const sortedDevices = [...devices].sort((a, b) => getSortValue(b) - getSortValue(a));

  const maxBrowserValue = Math.max(...browsers.map(b => getSortValue(b)), 1);
  const maxOSValue = Math.max(...operatingSystems.map(os => getSortValue(os)), 1);
  const maxDeviceValue = Math.max(...devices.map(d => getSortValue(d)), 1);

  return (
    <AnalyticsCard
      tabs={tabs}
      defaultTab="browser"
      rightAction={<SortToggle value={sortBy} onChange={setSortBy} />}
    >
      {(activeTab) => (
        <div className="space-y-1">
          {activeTab === 'browser' && (
            <>
              {sortedBrowsers.slice(0, 6).map((browser, i) => (
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
                    <div className="flex items-center justify-between cursor-pointer">
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
              ))}
              {browsers.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No browser data</div>
              )}
            </>
          )}
          
          {activeTab === 'os' && (
            <>
              {sortedOS.slice(0, 6).map((os, i) => (
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
                    <div className="flex items-center justify-between cursor-pointer">
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
              ))}
              {operatingSystems.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No OS data</div>
              )}
            </>
          )}
          
          {activeTab === 'device' && (
            <>
              {sortedDevices.map((device, i) => (
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
                    <div className="flex items-center justify-between cursor-pointer">
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
              ))}
              {devices.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">No device data</div>
              )}
            </>
          )}
        </div>
      )}
    </AnalyticsCard>
  );
}