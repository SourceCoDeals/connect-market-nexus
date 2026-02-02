import { useState } from "react";
import { AnalyticsCard, SortToggle } from "./AnalyticsCard";
import { AnalyticsTooltip } from "./AnalyticsTooltip";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrowserLogo, OSLogo } from "./BrowserLogo";
import { ProportionalBar } from "./ProportionalBar";

interface TechStackCardProps {
  browsers: Array<{ name: string; visitors: number; percentage: number }>;
  operatingSystems: Array<{ name: string; visitors: number; percentage: number }>;
  devices: Array<{ type: string; visitors: number; percentage: number }>;
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  'Desktop': <Monitor className="h-4 w-4" />,
  'Mobile': <Smartphone className="h-4 w-4" />,
  'Tablet': <Tablet className="h-4 w-4" />,
};

export function TechStackCard({ browsers, operatingSystems, devices }: TechStackCardProps) {
  const [sortBy, setSortBy] = useState<'visitors' | 'connections'>('visitors');
  
  const tabs = [
    { id: 'browser', label: 'Browser' },
    { id: 'os', label: 'OS' },
    { id: 'device', label: 'Device' },
  ];

  const maxBrowserVisitors = Math.max(...browsers.map(b => b.visitors), 1);
  const maxOSVisitors = Math.max(...operatingSystems.map(os => os.visitors), 1);
  const maxDeviceVisitors = Math.max(...devices.map(d => d.visitors), 1);

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
              {browsers.slice(0, 6).map((browser, i) => (
                <AnalyticsTooltip
                  key={`${browser.name}-${i}`}
                  title={browser.name}
                  rows={[
                    { label: 'Visitors', value: browser.visitors.toLocaleString() },
                    { label: 'Share', value: `${browser.percentage.toFixed(1)}%`, highlight: true },
                  ]}
                >
                  <ProportionalBar value={browser.visitors} maxValue={maxBrowserVisitors}>
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
                          {browser.visitors.toLocaleString()}
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
              {operatingSystems.slice(0, 6).map((os, i) => (
                <AnalyticsTooltip
                  key={`${os.name}-${i}`}
                  title={os.name}
                  rows={[
                    { label: 'Visitors', value: os.visitors.toLocaleString() },
                    { label: 'Share', value: `${os.percentage.toFixed(1)}%`, highlight: true },
                  ]}
                >
                  <ProportionalBar value={os.visitors} maxValue={maxOSVisitors}>
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
                          {os.visitors.toLocaleString()}
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
              {devices.map((device, i) => (
                <AnalyticsTooltip
                  key={`${device.type}-${i}`}
                  title={device.type}
                  rows={[
                    { label: 'Visitors', value: device.visitors.toLocaleString() },
                    { label: 'Share', value: `${device.percentage.toFixed(1)}%`, highlight: true },
                  ]}
                >
                  <ProportionalBar value={device.visitors} maxValue={maxDeviceVisitors}>
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
                          {device.visitors.toLocaleString()}
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
