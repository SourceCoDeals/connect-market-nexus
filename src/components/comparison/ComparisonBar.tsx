import { Button } from '@/components/ui/button';
import { useComparison } from '@/context/ComparisonContext';
import { X } from 'lucide-react';
import { useState } from 'react';
import { ComparisonView } from './ComparisonView';

export function ComparisonBar() {
  const { comparedListings, clearComparison } = useComparison();
  const [showComparison, setShowComparison] = useState(false);

  if (comparedListings.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50">
        <div className="container max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Comparing {comparedListings.length} {comparedListings.length === 1 ? 'deal' : 'deals'}
              </span>
              <div className="flex gap-2">
                {comparedListings.map(listing => (
                  <div
                    key={listing.id}
                    className="text-xs bg-muted px-2 py-1 rounded-md"
                  >
                    {listing.title.length > 30 
                      ? `${listing.title.substring(0, 30)}...` 
                      : listing.title
                    }
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearComparison}
              >
                Clear all
              </Button>
              <Button
                size="sm"
                onClick={() => setShowComparison(true)}
              >
                View comparison
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ComparisonView 
        open={showComparison} 
        onOpenChange={setShowComparison} 
      />
    </>
  );
}
