import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  BarChart3, 
  Plus,
  Trash2,
  Edit,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { IndustryKPI } from "@/types/remarketing";

interface IndustryKPIPanelProps {
  kpis: IndustryKPI[];
  onKPIsChange?: (kpis: IndustryKPI[]) => void;
  readOnly?: boolean;
}

const KPI_TEMPLATES: Record<string, IndustryKPI[]> = {
  collision_repair: [
    { id: 'cycle_time', name: 'Cycle Time', description: 'Average repair cycle time in days', weight: 15, threshold_max: 5, unit: 'days' },
    { id: 'touch_time', name: 'Touch Time', description: 'Hours of labor per RO', weight: 10, threshold_min: 12, unit: 'hours' },
    { id: 'csi_score', name: 'CSI Score', description: 'Customer satisfaction index', weight: 20, threshold_min: 90, unit: '%' },
    { id: 'dpp_capture', name: 'DRP Capture Rate', description: 'Percentage of DRP referrals captured', weight: 15, threshold_min: 80, unit: '%' },
  ],
  hvac: [
    { id: 'revenue_per_tech', name: 'Revenue per Technician', description: 'Annual revenue per service tech', weight: 20, threshold_min: 150000, unit: '$' },
    { id: 'service_agreement_rate', name: 'Service Agreement Rate', description: 'Percentage of customers on agreements', weight: 15, threshold_min: 40, unit: '%' },
    { id: 'callback_rate', name: 'Callback Rate', description: 'Percentage of jobs requiring callbacks', weight: 10, threshold_max: 5, unit: '%' },
    { id: 'avg_ticket', name: 'Average Ticket', description: 'Average service ticket value', weight: 15, threshold_min: 500, unit: '$' },
  ],
  software: [
    { id: 'arr_growth', name: 'ARR Growth', description: 'Year-over-year ARR growth rate', weight: 25, threshold_min: 20, unit: '%' },
    { id: 'net_retention', name: 'Net Revenue Retention', description: 'NRR percentage', weight: 20, threshold_min: 100, unit: '%' },
    { id: 'gross_margin', name: 'Gross Margin', description: 'Software gross margin', weight: 15, threshold_min: 70, unit: '%' },
    { id: 'cac_payback', name: 'CAC Payback', description: 'Months to recover CAC', weight: 15, threshold_max: 18, unit: 'months' },
  ],
  pest_control: [
    { id: 'recurring_revenue', name: 'Recurring Revenue %', description: 'Percentage from recurring services', weight: 25, threshold_min: 60, unit: '%' },
    { id: 'customer_retention', name: 'Customer Retention', description: 'Annual customer retention rate', weight: 20, threshold_min: 85, unit: '%' },
    { id: 'revenue_per_route', name: 'Revenue per Route', description: 'Monthly revenue per route', weight: 15, threshold_min: 40000, unit: '$' },
    { id: 'tech_productivity', name: 'Tech Productivity', description: 'Stops per technician per day', weight: 10, threshold_min: 12, unit: 'stops' },
  ],
};

export const IndustryKPIPanel = ({
  kpis = [],
  onKPIsChange,
  readOnly = false,
}: IndustryKPIPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingKPI, setEditingKPI] = useState<IndustryKPI | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const handleAddKPI = (kpi: IndustryKPI) => {
    if (onKPIsChange && !readOnly) {
      onKPIsChange([...kpis, kpi]);
    }
    setShowAddDialog(false);
  };

  const handleUpdateKPI = (updated: IndustryKPI) => {
    if (onKPIsChange && !readOnly) {
      onKPIsChange(kpis.map(k => k.id === updated.id ? updated : k));
    }
    setEditingKPI(null);
  };

  const handleDeleteKPI = (id: string) => {
    if (onKPIsChange && !readOnly) {
      onKPIsChange(kpis.filter(k => k.id !== id));
    }
  };

  const applyTemplate = (template: string) => {
    if (onKPIsChange && !readOnly && template in KPI_TEMPLATES) {
      onKPIsChange(KPI_TEMPLATES[template]);
    }
    setSelectedTemplate(template);
  };

  const totalWeight = kpis.reduce((sum, kpi) => sum + kpi.weight, 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Industry KPI Scoring</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {kpis.length === 0 
                      ? 'Configure optional scoring bonuses based on industry KPIs'
                      : `${kpis.length} KPIs configured (${totalWeight}% total weight)`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {kpis.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {kpis.length} KPIs
                  </Badge>
                )}
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground flex-1">
                KPIs are optional scoring bonuses. Deals matching KPI thresholds receive score boosts.
              </p>
            </div>

            {/* Template Selector */}
            {!readOnly && (
              <div className="flex items-center gap-3">
                <Select value={selectedTemplate} onValueChange={applyTemplate}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Load template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="collision_repair">Collision Repair</SelectItem>
                    <SelectItem value="hvac">HVAC</SelectItem>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="pest_control">Pest Control</SelectItem>
                  </SelectContent>
                </Select>
                
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add KPI
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New KPI</DialogTitle>
                    </DialogHeader>
                    <KPIEditForm
                      kpi={null}
                      onSave={handleAddKPI}
                      onCancel={() => setShowAddDialog(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* KPI List */}
            {kpis.length > 0 ? (
              <div className="space-y-2">
                {kpis.map((kpi) => (
                  <div 
                    key={kpi.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-background"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{kpi.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {kpi.weight}% weight
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {kpi.description}
                      </p>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        {kpi.threshold_min !== undefined && (
                          <span>Min: {kpi.threshold_min}{kpi.unit}</span>
                        )}
                        {kpi.threshold_max !== undefined && (
                          <span>Max: {kpi.threshold_max}{kpi.unit}</span>
                        )}
                      </div>
                    </div>
                    
                    {!readOnly && (
                      <div className="flex items-center gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit KPI</DialogTitle>
                            </DialogHeader>
                            <KPIEditForm
                              kpi={kpi}
                              onSave={handleUpdateKPI}
                              onCancel={() => setEditingKPI(null)}
                            />
                          </DialogContent>
                        </Dialog>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteKPI(kpi.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No KPIs configured</p>
                <p className="text-xs">Load a template or add custom KPIs</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

interface KPIEditFormProps {
  kpi: IndustryKPI | null;
  onSave: (kpi: IndustryKPI) => void;
  onCancel: () => void;
}

const KPIEditForm = ({ kpi, onSave, onCancel }: KPIEditFormProps) => {
  const [form, setForm] = useState<Partial<IndustryKPI>>(kpi || {
    id: `kpi_${Date.now()}`,
    name: '',
    description: '',
    weight: 10,
    unit: '%',
  });

  const handleSubmit = () => {
    if (form.name && form.weight) {
      onSave({
        id: form.id || `kpi_${Date.now()}`,
        name: form.name,
        description: form.description,
        weight: form.weight,
        threshold_min: form.threshold_min,
        threshold_max: form.threshold_max,
        unit: form.unit,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>KPI Name</Label>
        <Input
          value={form.name || ''}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g., Customer Retention Rate"
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={form.description || ''}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Brief description of this KPI"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Weight (%)</Label>
          <Input
            type="number"
            value={form.weight || ''}
            onChange={(e) => setForm({ ...form, weight: parseInt(e.target.value) || 0 })}
            min={1}
            max={100}
          />
        </div>
        <div className="space-y-2">
          <Label>Unit</Label>
          <Input
            value={form.unit || ''}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            placeholder="%"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Min Threshold (optional)</Label>
          <Input
            type="number"
            value={form.threshold_min ?? ''}
            onChange={(e) => setForm({ ...form, threshold_min: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label>Max Threshold (optional)</Label>
          <Input
            type="number"
            value={form.threshold_max ?? ''}
            onChange={(e) => setForm({ ...form, threshold_max: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!form.name}>
          {kpi ? 'Save Changes' : 'Add KPI'}
        </Button>
      </div>
    </div>
  );
};

export default IndustryKPIPanel;
