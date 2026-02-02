import { useState } from "react";
import { AnalyticsCard, SortToggle } from "./AnalyticsCard";
import { AnalyticsTooltip } from "./AnalyticsTooltip";
import { 
  Chrome, 
  Globe, 
  Smartphone, 
  Tablet, 
  Monitor,
  Apple
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TechStackCardProps {
  browsers: Array<{ name: string; visitors: number; percentage: number }>;
  operatingSystems: Array<{ name: string; visitors: number; percentage: number }>;
  devices: Array<{ type: string; visitors: number; percentage: number }>;
}

const BROWSER_ICONS: Record<string, React.ReactNode> = {
  'Chrome': <Chrome className="h-4 w-4" />,
  'Safari': <Globe className="h-4 w-4" />,
  'Firefox': <Globe className="h-4 w-4" />,
  'Edge': <Globe className="h-4 w-4" />,
  'Opera': <Globe className="h-4 w-4" />,
  'Unknown': <Globe className="h-4 w-4" />,
};

const OS_ICONS: Record<string, React.ReactNode> = {
  'macOS': <Apple className="h-4 w-4" />,
  'Mac OS': <Apple className="h-4 w-4" />,
  'Windows': <Monitor className="h-4 w-4" />,
  'iOS': <Smartphone className="h-4 w-4" />,
  'Android': <Smartphone className="h-4 w-4" />,
  'Linux': <Monitor className="h-4 w-4" />,
  'Unknown': <Monitor className="h-4 w-4" />,
};

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  'Desktop': <Monitor className="h-4 w-4" />,
  'Mobile': <Smartphone className="h-4 w-4" />,
  'Tablet': <Tablet className="h-4 w-4" />,
  'Unknown': <Monitor className="h-4 w-4" />,
};

function ProgressBar({ percentage, color }: { percentage: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div 
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function TechStackCard({ browsers, operatingSystems, devices }: TechStackCardProps) {
  const [sortBy, setSortBy] = useState<'visitors' | 'connections'>('visitors');
  
  const tabs = [
    { id: 'browser', label: 'Browser' },
    { id: 'os', label: 'OS' },
    { id: 'device', label: 'Device' },
  ];

  return (
    <AnalyticsCard
      tabs={tabs}
      defaultTab="browser"
      rightAction={<SortToggle value={sortBy} onChange={setSortBy} />}
    >
      {(activeTab) => (
        <div className="space-y-3">
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
                  <div className="space-y-1.5 cursor-pointer hover:bg-muted/30 -mx-2 px-2 py-1 rounded-md transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {BROWSER_ICONS[browser.name] || <Globe className="h-4 w-4" />}
                        </span>
                        <span className="text-sm">{browser.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {browser.percentage.toFixed(0)}%
                        </span>
                        <span className="text-sm font-medium tabular-nums w-10 text-right">
                          {browser.visitors.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <ProgressBar percentage={browser.percentage} color="hsl(12 95% 77%)" />
                  </div>
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
                  <div className="space-y-1.5 cursor-pointer hover:bg-muted/30 -mx-2 px-2 py-1 rounded-md transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {OS_ICONS[os.name] || <Monitor className="h-4 w-4" />}
                        </span>
                        <span className="text-sm">{os.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {os.percentage.toFixed(0)}%
                        </span>
                        <span className="text-sm font-medium tabular-nums w-10 text-right">
                          {os.visitors.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <ProgressBar percentage={os.percentage} color="hsl(220 70% 55%)" />
                  </div>
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
                  <div className="space-y-1.5 cursor-pointer hover:bg-muted/30 -mx-2 px-2 py-1 rounded-md transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {DEVICE_ICONS[device.type] || <Monitor className="h-4 w-4" />}
                        </span>
                        <span className="text-sm">{device.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {device.percentage.toFixed(0)}%
                        </span>
                        <span className="text-sm font-medium tabular-nums w-10 text-right">
                          {device.visitors.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <ProgressBar percentage={device.percentage} color="hsl(145 60% 45%)" />
                  </div>
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
