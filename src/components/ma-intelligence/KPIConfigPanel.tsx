import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Save, RotateCcw, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface KPI {
  name: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  points: number;
  unit?: string;
}

interface KPIConfigPanelProps {
  trackerId: string;
  tracker: {
    kpi_scoring_config?: {
      kpis: KPI[];
    };
  };
  onSave?: () => void;
}

const INDUSTRY_TEMPLATES: Record<string, KPI[]> = {
  'home_services': [
    { name: 'EBITDA Margin', operator: 'gte', threshold: 15, points: 10, unit: '%' },
    { name: 'Revenue per Location', operator: 'gte', threshold: 500000, points: 8, unit: '$' },
    { name: 'Customer Retention', operator: 'gte', threshold: 80, points: 7, unit: '%' },
    { name: 'Recurring Revenue %', operator: 'gte', threshold: 30, points: 10, unit: '%' },
    { name: 'Average Ticket Size', operator: 'gte', threshold: 500, points: 5, unit: '$' },
  ],
  'healthcare': [
    { name: 'EBITDA Margin', operator: 'gte', threshold: 20, points: 10, unit: '%' },
    { name: 'Patient Retention', operator: 'gte', threshold: 85, points: 8, unit: '%' },
    { name: 'Revenue per Provider', operator: 'gte', threshold: 400000, points: 7, unit: '$' },
    { name: 'Payor Mix - Commercial', operator: 'gte', threshold: 60, points: 10, unit: '%' },
    { name: 'Same Store Growth', operator: 'gte', threshold: 5, points: 8, unit: '%' },
  ],
  'manufacturing': [
    { name: 'EBITDA Margin', operator: 'gte', threshold: 12, points: 10, unit: '%' },
    { name: 'Gross Margin', operator: 'gte', threshold: 35, points: 8, unit: '%' },
    { name: 'Customer Concentration', operator: 'lte', threshold: 25, points: 7, unit: '%' },
    { name: 'Capacity Utilization', operator: 'gte', threshold: 70, points: 6, unit: '%' },
    { name: 'Revenue per Employee', operator: 'gte', threshold: 200000, points: 5, unit: '$' },
  ],
  'technology': [
    { name: 'Gross Margin', operator: 'gte', threshold: 70, points: 10, unit: '%' },
    { name: 'ARR Growth Rate', operator: 'gte', threshold: 20, points: 15, unit: '%' },
    { name: 'Net Revenue Retention', operator: 'gte', threshold: 100, points: 12, unit: '%' },
    { name: 'CAC Payback Period', operator: 'lte', threshold: 12, points: 8, unit: 'months' },
    { name: 'Customer Churn', operator: 'lte', threshold: 5, points: 10, unit: '%' },
  ],
};

const OPERATOR_LABELS = {
  'gt': '>',
  'lt': '<',
  'eq': '=',
  'gte': '≥',
  'lte': '≤',
};

export function KPIConfigPanel({ trackerId, tracker, onSave }: KPIConfigPanelProps) {
  const [kpis, setKpis] = useState<KPI[]>(tracker.kpi_scoring_config?.kpis || []);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('industry_trackers')
        .update({
          kpi_scoring_config: { kpis },
        })
        .eq('id', trackerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "KPI configuration saved successfully",
      });

      setHasChanges(false);
      onSave?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setKpis(tracker.kpi_scoring_config?.kpis || []);
    setHasChanges(false);
  };

  const handleAddKPI = () => {
    setKpis([
      ...kpis,
      { name: '', operator: 'gte', threshold: 0, points: 5, unit: '' },
    ]);
    setHasChanges(true);
  };

  const handleDeleteKPI = (index: number) => {
    setKpis(kpis.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleUpdateKPI = (index: number, field: keyof KPI, value: any) => {
    const updated = [...kpis];
    updated[index] = { ...updated[index], [field]: value };
    setKpis(updated);
    setHasChanges(true);
  };

  const handleLoadTemplate = (template: string) => {
    if (template === 'none') return;

    const templateKPIs = INDUSTRY_TEMPLATES[template];
    if (templateKPIs) {
      setKpis(templateKPIs);
      setHasChanges(true);
      toast({
        title: "Template Loaded",
        description: `${template.replace('_', ' ')} KPIs loaded successfully`,
      });
    }
  };

  const totalPoints = kpis.reduce((sum, kpi) => sum + (kpi.points || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>KPI Scoring Configuration</CardTitle>
            <CardDescription>
              Configure industry-specific KPIs for enhanced deal scoring
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && <Badge variant="secondary">Unsaved changes</Badge>}
            <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template Selector */}
        <div className="space-y-2">
          <Label htmlFor="template">Industry Template</Label>
          <Select onValueChange={handleLoadTemplate}>
            <SelectTrigger id="template">
              <SelectValue placeholder="Select a template to get started..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Custom)</SelectItem>
              <SelectItem value="home_services">Home Services</SelectItem>
              <SelectItem value="healthcare">Healthcare</SelectItem>
              <SelectItem value="manufacturing">Manufacturing</SelectItem>
              <SelectItem value="technology">Technology/SaaS</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Load a pre-configured template or build your own from scratch
          </p>
        </div>

        {/* KPI Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>KPI Name</TableHead>
                <TableHead className="w-24">Operator</TableHead>
                <TableHead className="w-32">Threshold</TableHead>
                <TableHead className="w-24">Unit</TableHead>
                <TableHead className="w-24">Points</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No KPIs configured. Click "Add KPI" or select a template to get started.
                  </TableCell>
                </TableRow>
              ) : (
                kpis.map((kpi, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        value={kpi.name}
                        onChange={(e) => handleUpdateKPI(index, 'name', e.target.value)}
                        placeholder="e.g., EBITDA Margin"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={kpi.operator}
                        onValueChange={(value) => handleUpdateKPI(index, 'operator', value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gt">&gt; Greater than</SelectItem>
                          <SelectItem value="gte">≥ Greater/Equal</SelectItem>
                          <SelectItem value="lt">&lt; Less than</SelectItem>
                          <SelectItem value="lte">≤ Less/Equal</SelectItem>
                          <SelectItem value="eq">= Equal to</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={kpi.threshold}
                        onChange={(e) => handleUpdateKPI(index, 'threshold', parseFloat(e.target.value) || 0)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={kpi.unit || ''}
                        onChange={(e) => handleUpdateKPI(index, 'unit', e.target.value)}
                        placeholder="%"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={kpi.points}
                        onChange={(e) => handleUpdateKPI(index, 'points', parseInt(e.target.value) || 0)}
                        min={0}
                        max={15}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteKPI(index)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Add KPI Button */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleAddKPI}>
            <Plus className="w-4 h-4 mr-2" />
            Add KPI
          </Button>
          <Badge variant="outline" className="text-sm">
            Total Points: {totalPoints}
          </Badge>
        </div>

        {/* Preview Section */}
        {kpis.length > 0 && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium mb-3">KPI Scoring Preview</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  How these KPIs will affect deal scoring:
                </p>
                <div className="space-y-2">
                  {kpis.map((kpi, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{kpi.name || `KPI ${index + 1}`}</span>
                        <Badge variant="secondary" className="text-xs">
                          {OPERATOR_LABELS[kpi.operator]} {kpi.threshold}{kpi.unit}
                        </Badge>
                      </div>
                      <span className="text-muted-foreground">+{kpi.points} points</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between font-medium">
                    <span>Maximum KPI Bonus</span>
                    <span className="text-primary">+{totalPoints} points</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Deals meeting all KPI thresholds can earn up to {totalPoints} bonus points, added to their composite score.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p>• KPIs are optional scoring enhancements based on industry-specific metrics</p>
          <p>• Each KPI can contribute 0-15 points to a deal's composite score</p>
          <p>• Points are awarded when the deal meets the specified threshold</p>
          <p>• Configure KPIs based on what matters most in your industry</p>
        </div>
      </CardContent>
    </Card>
  );
}
