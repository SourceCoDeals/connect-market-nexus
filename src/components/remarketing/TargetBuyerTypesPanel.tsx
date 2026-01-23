import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  Users, 
  Building2, 
  TrendingUp,
  Briefcase,
  Home,
  Store,
  Edit,
  GripVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TargetBuyerTypeConfig } from "@/types/remarketing";

interface TargetBuyerTypesPanelProps {
  buyerTypes: TargetBuyerTypeConfig[];
  onBuyerTypesChange?: (types: TargetBuyerTypeConfig[]) => void;
  readOnly?: boolean;
}

const DEFAULT_BUYER_TYPES: TargetBuyerTypeConfig[] = [
  {
    id: 'large_mso',
    rank: 1,
    name: 'Large MSOs',
    description: 'Multi-state operators with 50+ locations seeking add-on acquisitions in key markets.',
    locations_min: 50,
    locations_max: 500,
    revenue_per_location: 2500000,
    deal_requirements: 'Prefer deals with $2M+ revenue, strong management team willing to stay',
    enabled: true,
  },
  {
    id: 'regional_mso',
    rank: 2,
    name: 'Regional MSOs',
    description: 'Regional operators with 10-50 locations expanding within their geographic footprint.',
    locations_min: 10,
    locations_max: 50,
    revenue_per_location: 2000000,
    deal_requirements: 'Looking for tuck-in acquisitions, prefer seller financing available',
    enabled: true,
  },
  {
    id: 'pe_backed',
    rank: 3,
    name: 'PE-Backed Platforms',
    description: 'Private equity portfolio companies actively deploying capital for roll-up strategies.',
    locations_min: 5,
    locations_max: 100,
    revenue_per_location: 1500000,
    deal_requirements: 'Need clean financials, will pay premium for EBITDA margin above 15%',
    enabled: true,
  },
  {
    id: 'independent_sponsor',
    rank: 4,
    name: 'Independent Sponsors',
    description: 'Dealmakers with committed capital seeking platform investments.',
    locations_min: 1,
    locations_max: 10,
    revenue_per_location: 1000000,
    deal_requirements: 'Flexible on structure, open to earnouts and seller notes',
    enabled: true,
  },
  {
    id: 'small_local',
    rank: 5,
    name: 'Small Local Buyers',
    description: 'Owner-operators looking to expand from 1-5 locations in their local market.',
    locations_min: 1,
    locations_max: 5,
    revenue_per_location: 800000,
    deal_requirements: 'Often need SBA financing, prefer deals under $1M',
    enabled: true,
  },
  {
    id: 'local_strategic',
    rank: 6,
    name: 'Local Strategics',
    description: 'Established local businesses seeking adjacent market expansion.',
    locations_min: 2,
    locations_max: 15,
    revenue_per_location: 1200000,
    deal_requirements: 'Looking for synergies, willing to pay for customer relationships',
    enabled: true,
  },
];

const BUYER_TYPE_ICONS: Record<string, typeof Building2> = {
  large_mso: Building2,
  regional_mso: TrendingUp,
  pe_backed: Briefcase,
  independent_sponsor: Users,
  small_local: Home,
  local_strategic: Store,
};

export const TargetBuyerTypesPanel = ({
  buyerTypes = DEFAULT_BUYER_TYPES,
  onBuyerTypesChange,
  readOnly = false,
}: TargetBuyerTypesPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingType, setEditingType] = useState<TargetBuyerTypeConfig | null>(null);

  const handleToggle = (id: string, enabled: boolean) => {
    if (onBuyerTypesChange && !readOnly) {
      onBuyerTypesChange(
        buyerTypes.map(t => t.id === id ? { ...t, enabled } : t)
      );
    }
  };

  const handleUpdate = (updated: TargetBuyerTypeConfig) => {
    if (onBuyerTypesChange && !readOnly) {
      onBuyerTypesChange(
        buyerTypes.map(t => t.id === updated.id ? updated : t)
      );
    }
    setEditingType(null);
  };

  const enabledCount = buyerTypes.filter(t => t.enabled).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Target Buyer Types</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {enabledCount} of {buyerTypes.length} buyer types enabled
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {buyerTypes.filter(t => t.enabled).slice(0, 4).map(t => (
                    <Badge key={t.id} variant="outline" className="text-xs">
                      #{t.rank}
                    </Badge>
                  ))}
                  {enabledCount > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{enabledCount - 4}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {buyerTypes.sort((a, b) => a.rank - b.rank).map((buyerType) => {
                const Icon = BUYER_TYPE_ICONS[buyerType.id] || Building2;
                
                return (
                  <Card 
                    key={buyerType.id} 
                    className={cn(
                      "relative transition-all",
                      !buyerType.enabled && "opacity-50",
                      buyerType.rank === 1 && buyerType.enabled && "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800",
                      buyerType.rank === 2 && buyerType.enabled && "bg-gray-50/50 border-gray-200 dark:bg-gray-950/20 dark:border-gray-700"
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center",
                            buyerType.enabled ? "bg-primary/10" : "bg-muted"
                          )}>
                            <Icon className={cn(
                              "h-4 w-4",
                              buyerType.enabled ? "text-primary" : "text-muted-foreground"
                            )} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-sm">{buyerType.name}</CardTitle>
                              <Badge 
                                variant="default" 
                                className={cn(
                                  "text-xs px-1.5 py-0",
                                  buyerType.rank === 1 && "bg-amber-500",
                                  buyerType.rank === 2 && "bg-gray-400",
                                  buyerType.rank === 3 && "bg-amber-700",
                                  buyerType.rank > 3 && "bg-muted-foreground"
                                )}
                              >
                                #{buyerType.rank}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!readOnly && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7"
                                  onClick={() => setEditingType(buyerType)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit {buyerType.name}</DialogTitle>
                                </DialogHeader>
                                <BuyerTypeEditForm 
                                  buyerType={buyerType} 
                                  onSave={handleUpdate}
                                  onCancel={() => setEditingType(null)}
                                />
                              </DialogContent>
                            </Dialog>
                          )}
                          <Switch
                            checked={buyerType.enabled}
                            onCheckedChange={(checked) => handleToggle(buyerType.id, checked)}
                            disabled={readOnly}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {buyerType.description}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-muted/50 rounded px-2 py-1">
                          <span className="text-muted-foreground">Locations:</span>
                          <span className="ml-1 font-medium">
                            {buyerType.locations_min} - {buyerType.locations_max}
                          </span>
                        </div>
                        <div className="bg-muted/50 rounded px-2 py-1">
                          <span className="text-muted-foreground">Rev/Loc:</span>
                          <span className="ml-1 font-medium">
                            ${((buyerType.revenue_per_location || 0) / 1000000).toFixed(1)}M
                          </span>
                        </div>
                      </div>

                      {buyerType.deal_requirements && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Requirements:</span>
                          <p className="mt-0.5 text-foreground line-clamp-2">
                            {buyerType.deal_requirements}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

interface BuyerTypeEditFormProps {
  buyerType: TargetBuyerTypeConfig;
  onSave: (updated: TargetBuyerTypeConfig) => void;
  onCancel: () => void;
}

const BuyerTypeEditForm = ({ buyerType, onSave, onCancel }: BuyerTypeEditFormProps) => {
  const [form, setForm] = useState(buyerType);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Min Locations</Label>
          <Input
            type="number"
            value={form.locations_min || ''}
            onChange={(e) => setForm({ ...form, locations_min: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Max Locations</Label>
          <Input
            type="number"
            value={form.locations_max || ''}
            onChange={(e) => setForm({ ...form, locations_max: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Revenue per Location ($)</Label>
        <Input
          type="number"
          value={form.revenue_per_location || ''}
          onChange={(e) => setForm({ ...form, revenue_per_location: parseInt(e.target.value) || 0 })}
        />
      </div>

      <div className="space-y-2">
        <Label>Deal Requirements</Label>
        <Textarea
          value={form.deal_requirements || ''}
          onChange={(e) => setForm({ ...form, deal_requirements: e.target.value })}
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)}>Save Changes</Button>
      </div>
    </div>
  );
};

export default TargetBuyerTypesPanel;
