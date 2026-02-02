import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save } from "lucide-react";

interface KPIConfigPanelProps {
  trackerId: string;
  kpiConfig: Record<string, unknown> | null;
  onSave: (config: Record<string, unknown>) => void;
}

export function KPIConfigPanel({ trackerId, kpiConfig, onSave }: KPIConfigPanelProps) {
  const [config, setConfig] = useState<Record<string, unknown>>(kpiConfig || {});

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>KPI Configuration</CardTitle>
            <CardDescription>
              Industry-specific KPIs for enhanced deal scoring
            </CardDescription>
          </div>
          <Badge variant="secondary">Coming Soon</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-muted-foreground">
          <p>Industry-specific KPI configuration panel will be available soon</p>
          <p className="text-sm mt-2">This will include templates for healthcare, home services, B2B SaaS, and more</p>
        </div>
      </CardContent>
    </Card>
  );
}
