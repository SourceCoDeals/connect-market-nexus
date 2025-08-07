import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitCompare, Star, TrendingUp, MapPin, Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

interface DealComparisonWidgetProps {
  currentListingId: string;
  formatCurrency: (value: number) => string;
}

interface SavedListing {
  id: string;
  title: string;
  location: string;
  category: string;
  revenue: number;
  ebitda: number;
  created_at: string;
  image_url?: string;
}

export const DealComparisonWidget: React.FC<DealComparisonWidgetProps> = ({ 
  currentListingId, 
  formatCurrency 
}) => {
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadSavedListings();
    }
  }, [user, currentListingId]);

  const loadSavedListings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_listings')
        .select(`
          listing_id,
          listings!inner (
            id,
            title,
            location,
            category,
            revenue,
            ebitda,
            created_at,
            image_url
          )
        `)
        .eq('user_id', user?.id)
        .neq('listing_id', currentListingId)
        .limit(3);

      if (error) throw error;

      const listings = data?.map(item => ({
        id: item.listings.id,
        title: item.listings.title,
        location: item.listings.location,
        category: item.listings.category,
        revenue: item.listings.revenue,
        ebitda: item.listings.ebitda,
        created_at: item.listings.created_at,
        image_url: item.listings.image_url
      })) || [];

      setSavedListings(listings);
    } catch (error) {
      console.error('Error loading saved listings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateEBITDAMargin = (revenue: number, ebitda: number) => {
    if (!revenue || revenue === 0) return 0;
    return (ebitda / revenue) * 100;
  };

  const getPerformanceIndicator = (margin: number) => {
    if (margin >= 20) return { color: 'text-green-600', label: 'Strong' };
    if (margin >= 10) return { color: 'text-yellow-600', label: 'Good' };
    return { color: 'text-red-600', label: 'Weak' };
  };

  if (!user || savedListings.length === 0) {
    return (
      <Card className="border-sourceco-form bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-sourceco-text flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Compare Deals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-xs text-gray-500 mb-3">
              Save more listings to compare investment opportunities
            </p>
            <Link to="/marketplace">
              <Button variant="outline" className="text-xs">
                Browse Marketplace
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-sourceco-form bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-sourceco-text flex items-center gap-2">
          <GitCompare className="h-4 w-4" />
          Compare with Saved Deals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {savedListings.map((listing) => {
          const margin = calculateEBITDAMargin(listing.revenue, listing.ebitda);
          const performance = getPerformanceIndicator(margin);
          
          return (
            <div 
              key={listing.id}
              className="border border-gray-200 rounded-lg p-3 hover:border-[#d7b65c] transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <Link 
                    to={`/listing/${listing.id}`}
                    className="text-sm font-medium text-sourceco-text hover:text-[#d7b65c] transition-colors truncate block"
                  >
                    {listing.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" />
                      {listing.location}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {listing.category}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-600">Revenue</div>
                  <div className="text-sm font-medium">
                    {formatCurrency(listing.revenue)}
                  </div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-600">EBITDA</div>
                  <div className="text-sm font-medium">
                    {formatCurrency(listing.ebitda)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs">
                  <TrendingUp className="h-3 w-3" />
                  <span className="text-gray-600">Margin:</span>
                  <span className={performance.color}>
                    {margin.toFixed(1)}% ({performance.label})
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="h-3 w-3" />
                  {new Date(listing.created_at).toLocaleDateString()}
                </div>
              </div>

              <Link to={`/listing/${listing.id}`}>
                <Button 
                  variant="outline" 
                  className="w-full mt-2 h-7 text-xs hover:bg-[#d7b65c] hover:text-white hover:border-[#d7b65c]"
                >
                  Compare Details
                </Button>
              </Link>
            </div>
          );
        })}

        <Link to="/saved-listings">
          <Button 
            variant="outline" 
            className="w-full text-xs border-[#d7b65c] text-[#d7b65c] hover:bg-[#d7b65c] hover:text-white"
          >
            View All Saved Deals
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};