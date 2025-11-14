import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useComparison } from '@/context/ComparisonContext';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ComparisonViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComparisonView({ open, onOpenChange }: ComparisonViewProps) {
  const { comparedListings, removeFromComparison } = useComparison();
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const calculateMargin = (ebitda: number, revenue: number) => {
    if (revenue === 0) return 'N/A';
    return `${((ebitda / revenue) * 100).toFixed(1)}%`;
  };

  const rows = [
    { label: 'Title', key: 'title' as const },
    { label: 'Category', key: 'category' as const },
    { label: 'Location', key: 'location' as const },
    { label: 'Revenue', key: 'revenue' as const, format: formatCurrency },
    { label: 'EBITDA', key: 'ebitda' as const, format: formatCurrency },
    { label: 'EBITDA Margin', key: 'margin' as const },
    { label: 'Status', key: 'status' as const },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Deal comparison</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Metric
                </th>
                {comparedListings.map(listing => (
                  <th key={listing.id} className="text-left py-3 px-4 min-w-[180px]">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => {
                          onOpenChange(false);
                          navigate(`/listing/${listing.id}`);
                        }}
                        className="text-sm font-medium hover:underline text-left"
                      >
                        {listing.title}
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => removeFromComparison(listing.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.label}
                  className={index % 2 === 0 ? 'bg-muted/30' : ''}
                >
                  <td className="py-3 px-4 text-sm text-muted-foreground font-medium">
                    {row.label}
                  </td>
                  {comparedListings.map(listing => (
                    <td key={listing.id} className="py-3 px-4 text-sm">
                      {row.key === 'margin'
                        ? calculateMargin(listing.ebitda, listing.revenue)
                        : row.format
                        ? row.format(listing[row.key] as number)
                        : listing[row.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
