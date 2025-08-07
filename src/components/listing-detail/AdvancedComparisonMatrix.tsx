import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TrendingUp, TrendingDown, Minus, BarChart3, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface SavedListing {
  id: string;
  title: string;
  location: string;
  category: string;
  revenue: number;
  ebitda: number;
  created_at: string;
}

interface AdvancedComparisonMatrixProps {
  currentListingId: string;
  currentListing: {
    title: string;
    revenue: number;
    ebitda: number;
    location: string;
    category: string;
  };
  formatCurrency: (value: number) => string;
}

export const AdvancedComparisonMatrix: React.FC<AdvancedComparisonMatrixProps> = ({
  currentListingId,
  currentListing,
  formatCurrency
}) => {
  const { user } = useAuth();
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSavedListings();
    }
  }, [user]);

  const loadSavedListings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_listings')
        .select(`
          listing_id,
          listings:listing_id (
            id,
            title,
            location,
            category,
            revenue,
            ebitda,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .neq('listing_id', currentListingId);

      if (error) throw error;

      const listings = data
        ?.map(item => item.listings)
        .filter(Boolean)
        .slice(0, 3) as SavedListing[];

      setSavedListings(listings || []);
    } catch (error) {
      console.error('Error loading saved listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleListingToggle = (listingId: string) => {
    setSelectedListings(prev => 
      prev.includes(listingId) 
        ? prev.filter(id => id !== listingId)
        : [...prev.slice(0, 2), listingId] // Max 3 total (current + 2 others)
    );
  };

  const calculateMetrics = (listing: any) => {
    const margin = listing.revenue > 0 ? (listing.ebitda / listing.revenue) * 100 : 0;
    const multiple = listing.ebitda > 0 ? (listing.ebitda * 4.5) / 1000000 : 0;
    return { margin, multiple };
  };

  const getPerformanceIndicator = (current: number, comparison: number) => {
    if (current > comparison * 1.1) return { icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' };
    if (current < comparison * 0.9) return { icon: TrendingDown, color: 'text-destructive', bg: 'bg-destructive/10' };
    return { icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted' };
  };

  const compareListings = () => {
    const comparisons = selectedListings.map(id => 
      savedListings.find(l => l.id === id)
    ).filter(Boolean);

    return [currentListing, ...comparisons];
  };

  if (loading) {
    return (
      <Card className="border-sourceco-form">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Advanced Deal Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-sourceco-muted rounded w-3/4"></div>
            <div className="h-12 bg-sourceco-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="border-sourceco-form">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Advanced Deal Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Sign in to compare deals with your saved listings
          </p>
        </CardContent>
      </Card>
    );
  }

  if (savedListings.length === 0) {
    return (
      <Card className="border-sourceco-form">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Advanced Deal Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Save more deals to enable side-by-side comparison
          </p>
        </CardContent>
      </Card>
    );
  }

  const listings = compareListings();
  const currentMetrics = calculateMetrics(currentListing);

  return (
    <Card className="border-sourceco-form">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Advanced Deal Comparison
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Select deals to compare side-by-side metrics
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selection Interface */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Compare With:
          </span>
          {savedListings.map((listing) => (
            <div key={listing.id} className="flex items-center space-x-2 p-2 rounded border border-sourceco-form/50">
              <Checkbox
                id={listing.id}
                checked={selectedListings.includes(listing.id)}
                onCheckedChange={() => handleListingToggle(listing.id)}
                disabled={selectedListings.length >= 2 && !selectedListings.includes(listing.id)}
              />
              <label 
                htmlFor={listing.id} 
                className="text-xs flex-1 cursor-pointer"
              >
                <div className="font-medium">{listing.title}</div>
                <div className="text-muted-foreground">{listing.location} • {listing.category}</div>
              </label>
            </div>
          ))}
        </div>

        {/* Comparison Matrix */}
        {selectedListings.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-sourceco-form">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Comparison Matrix:
            </span>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-sourceco-form">
                    <th className="text-left p-2 font-medium">Metric</th>
                    <th className="text-center p-2 font-medium bg-sourceco-muted/30 rounded-t">Current</th>
                    {listings.slice(1).map((listing, idx) => (
                      <th key={idx} className="text-center p-2 font-medium">
                        Deal {idx + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="space-y-1">
                  <tr className="border-b border-sourceco-form/30">
                    <td className="p-2 font-medium">Revenue</td>
                    <td className="text-center p-2 bg-sourceco-muted/30">
                      {formatCurrency(currentListing.revenue)}
                    </td>
                    {listings.slice(1).map((listing, idx) => {
                      const indicator = getPerformanceIndicator(listing.revenue, currentListing.revenue);
                      return (
                        <td key={idx} className="text-center p-2">
                          <div className="flex items-center justify-center gap-1">
                            {formatCurrency(listing.revenue)}
                            <div className={`p-1 rounded ${indicator.bg}`}>
                              <indicator.icon className={`h-3 w-3 ${indicator.color}`} />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  
                  <tr className="border-b border-sourceco-form/30">
                    <td className="p-2 font-medium">EBITDA</td>
                    <td className="text-center p-2 bg-sourceco-muted/30">
                      {formatCurrency(currentListing.ebitda)}
                    </td>
                    {listings.slice(1).map((listing, idx) => {
                      const indicator = getPerformanceIndicator(listing.ebitda, currentListing.ebitda);
                      return (
                        <td key={idx} className="text-center p-2">
                          <div className="flex items-center justify-center gap-1">
                            {formatCurrency(listing.ebitda)}
                            <div className={`p-1 rounded ${indicator.bg}`}>
                              <indicator.icon className={`h-3 w-3 ${indicator.color}`} />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  
                  <tr className="border-b border-sourceco-form/30">
                    <td className="p-2 font-medium">EBITDA Margin</td>
                    <td className="text-center p-2 bg-sourceco-muted/30">
                      {currentMetrics.margin.toFixed(1)}%
                    </td>
                    {listings.slice(1).map((listing, idx) => {
                      const metrics = calculateMetrics(listing);
                      const indicator = getPerformanceIndicator(metrics.margin, currentMetrics.margin);
                      return (
                        <td key={idx} className="text-center p-2">
                          <div className="flex items-center justify-center gap-1">
                            {metrics.margin.toFixed(1)}%
                            <div className={`p-1 rounded ${indicator.bg}`}>
                              <indicator.icon className={`h-3 w-3 ${indicator.color}`} />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  <tr>
                    <td className="p-2 font-medium">Category</td>
                    <td className="text-center p-2 bg-sourceco-muted/30">
                      <Badge variant="outline" className="text-xs border-sourceco-accent/30">
                        {currentListing.category}
                      </Badge>
                    </td>
                    {listings.slice(1).map((listing, idx) => (
                      <td key={idx} className="text-center p-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            listing.category === currentListing.category 
                              ? 'border-success/30 text-success bg-success/10' 
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {listing.category}
                        </Badge>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs border-sourceco-accent text-sourceco-accent hover:bg-sourceco-accent hover:text-white"
              >
                Export Comparison Report
                <ArrowRight className="h-3 w-3 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};