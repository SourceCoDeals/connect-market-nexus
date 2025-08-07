import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, MapPin, DollarSign, TrendingUp } from 'lucide-react';
import { useUpdateDealAlert, DealAlert, UpdateDealAlertRequest } from '@/hooks/use-deal-alerts';
import { useListingMetadata } from '@/hooks/marketplace/use-listings';
import { MultiCategorySelect } from '@/components/ui/category-select';
import { MultiLocationSelect } from '@/components/ui/location-select';

const REVENUE_RANGES = [
  { label: 'Under $1M', min: 0, max: 1000000 },
  { label: '$1M - $5M', min: 1000000, max: 5000000 },
  { label: '$5M - $10M', min: 5000000, max: 10000000 },
  { label: '$10M - $25M', min: 10000000, max: 25000000 },
  { label: '$25M - $50M', min: 25000000, max: 50000000 },
  { label: 'Over $50M', min: 50000000, max: undefined },
];

const EBITDA_RANGES = [
  { label: 'Under $500K', min: 0, max: 500000 },
  { label: '$500K - $2M', min: 500000, max: 2000000 },
  { label: '$2M - $5M', min: 2000000, max: 5000000 },
  { label: '$5M - $10M', min: 5000000, max: 10000000 },
  { label: 'Over $10M', min: 10000000, max: undefined },
];

interface EditDealAlertDialogProps {
  alert: DealAlert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDealAlertDialog({ alert, open, onOpenChange }: EditDealAlertDialogProps) {
  const [formData, setFormData] = useState<UpdateDealAlertRequest>({
    name: '',
    criteria: {},
    frequency: 'daily',
  });

  const updateAlert = useUpdateDealAlert();
  const { data: metadata } = useListingMetadata();
  
  const categories = metadata?.categories || [];
  const locations = metadata?.locations || [];

  useEffect(() => {
    if (alert) {
      setFormData({
        name: alert.name,
        criteria: alert.criteria,
        frequency: alert.frequency,
      });
    }
  }, [alert]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !alert) return;

    try {
      await updateAlert.mutateAsync({
        id: alert.id,
        updates: formData,
      });
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const updateCriteria = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        [key]: value,
      },
    }));
  };

  const handleRevenueRangeChange = (value: string) => {
    if (value === 'all') {
      updateCriteria('revenueMin', undefined);
      updateCriteria('revenueMax', undefined);
      return;
    }
    const range = REVENUE_RANGES.find(r => r.label === value);
    if (range) {
      updateCriteria('revenueMin', range.min);
      updateCriteria('revenueMax', range.max);
    }
  };

  const handleEbitdaRangeChange = (value: string) => {
    if (value === 'all') {
      updateCriteria('ebitdaMin', undefined);
      updateCriteria('ebitdaMax', undefined);
      return;
    }
    const range = EBITDA_RANGES.find(r => r.label === value);
    if (range) {
      updateCriteria('ebitdaMin', range.min);
      updateCriteria('ebitdaMax', range.max);
    }
  };

  const getCurrentRevenueRange = () => {
    const criteria = formData.criteria;
    if (!criteria.revenueMin && !criteria.revenueMax) return 'all';
    const range = REVENUE_RANGES.find(r => 
      r.min === criteria.revenueMin && r.max === criteria.revenueMax
    );
    return range?.label || 'all';
  };

  const getCurrentEbitdaRange = () => {
    const criteria = formData.criteria;
    if (!criteria.ebitdaMin && !criteria.ebitdaMax) return 'all';
    const range = EBITDA_RANGES.find(r => 
      r.min === criteria.ebitdaMin && r.max === criteria.ebitdaMax
    );
    return range?.label || 'all';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Deal Alert</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Alert Name</Label>
            <Input
              id="name"
              placeholder="e.g., Tech Companies in California"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alert Criteria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Search Keywords
                  </Label>
                  <Input
                    placeholder="e.g., SaaS, manufacturing"
                    value={formData.criteria.search || ''}
                    onChange={(e) => updateCriteria('search', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Categories</Label>
                  <MultiCategorySelect
                    value={formData.criteria.categories ?? (formData.criteria.category ? [formData.criteria.category] : [])}
                    onValueChange={(values) => {
                      updateCriteria('categories', values);
                      updateCriteria('category', values.length === 1 ? values[0] : '');
                    }}
                    placeholder="Any categories"
                    className="z-[200]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Locations
                  </Label>
                  <MultiLocationSelect
                    value={formData.criteria.locations ?? (formData.criteria.location ? [formData.criteria.location] : [])}
                    onValueChange={(values) => {
                      updateCriteria('locations', values);
                      updateCriteria('location', values.length === 1 ? values[0] : '');
                    }}
                    placeholder="Any locations"
                    className="z-[200]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value: 'instant' | 'daily' | 'weekly') => 
                      setFormData(prev => ({ ...prev, frequency: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant">Instant (immediate notification)</SelectItem>
                      <SelectItem value="daily">Daily digest</SelectItem>
                      <SelectItem value="weekly">Weekly digest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Revenue Range
                  </Label>
                  <Select 
                    value={getCurrentRevenueRange()}
                    onValueChange={handleRevenueRangeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any revenue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any revenue</SelectItem>
                      {REVENUE_RANGES.map(range => (
                        <SelectItem key={range.label} value={range.label}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    EBITDA Range
                  </Label>
                  <Select 
                    value={getCurrentEbitdaRange()}
                    onValueChange={handleEbitdaRangeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any EBITDA" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any EBITDA</SelectItem>
                      {EBITDA_RANGES.map(range => (
                        <SelectItem key={range.label} value={range.label}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name.trim() || updateAlert.isPending}>
              {updateAlert.isPending ? 'Updating...' : 'Update Alert'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}