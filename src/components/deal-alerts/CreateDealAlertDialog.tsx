import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Search, MapPin, DollarSign, TrendingUp } from 'lucide-react';
import { useCreateDealAlert, CreateDealAlertRequest } from '@/hooks/use-deal-alerts';
import { useListingMetadata } from '@/hooks/marketplace/use-listings';

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


interface CreateDealAlertDialogProps {
  trigger?: React.ReactNode;
}

export function CreateDealAlertDialog({ trigger }: CreateDealAlertDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<CreateDealAlertRequest>({
    name: '',
    criteria: {},
    frequency: 'daily',
  });

  const createAlert = useCreateDealAlert();
  const { data: metadata } = useListingMetadata();
  
  const categories = metadata?.categories || [];
  const locations = metadata?.locations || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      await createAlert.mutateAsync(formData);
      setOpen(false);
      setFormData({
        name: '',
        criteria: {},
        frequency: 'daily',
      });
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
    const range = REVENUE_RANGES.find(r => r.label === value);
    if (range) {
      updateCriteria('revenueMin', range.min);
      updateCriteria('revenueMax', range.max);
    }
  };

  const handleEbitdaRangeChange = (value: string) => {
    const range = EBITDA_RANGES.find(r => r.label === value);
    if (range) {
      updateCriteria('ebitdaMin', range.min);
      updateCriteria('ebitdaMax', range.max);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
            <Bell className="h-4 w-4 mr-2" />
            Get Deal Alerts
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-50">
        <DialogHeader>
          <DialogTitle>Get First Access to New Deals</DialogTitle>
          <p className="text-sm text-muted-foreground">
            We'll email you immediately when new opportunities match your criteria, giving you the first look at deals before others.
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">What deals are you looking for?</Label>
            <Input
              id="name"
              placeholder="e.g., SaaS companies in California under $5M revenue"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <p className="text-xs text-muted-foreground">
              This helps you identify your alerts and will be included in your email notifications.
            </p>
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
                  <Label>Category</Label>
                  <Select
                    value={formData.criteria.category || 'all'}
                    onValueChange={(value) => updateCriteria('category', value === 'all' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any category" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      <SelectItem value="all">Any category</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  <Select
                    value={formData.criteria.location || 'all'}
                    onValueChange={(value) => updateCriteria('location', value === 'all' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any location" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      <SelectItem value="all">Any location</SelectItem>
                      {locations.map(location => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <SelectContent className="z-50">
                      <SelectItem value="instant">Only when deals match my criteria (recommended)</SelectItem>
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
                  <Select onValueChange={handleRevenueRangeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any revenue" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
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
                  <Select onValueChange={handleEbitdaRangeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any EBITDA" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name.trim() || createAlert.isPending}>
              {createAlert.isPending ? 'Creating...' : 'Create Alert'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}