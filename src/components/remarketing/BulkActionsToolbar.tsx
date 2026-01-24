import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Check,
  X,
  Download,
  Mail,
  ChevronDown,
  Loader2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface BulkActionsToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkApprove: () => Promise<void>;
  onBulkPass: (reason: string, category: string) => Promise<void>;
  onExportCSV: () => void;
  isProcessing?: boolean;
}

const passReasons = [
  { reason: 'No presence in target geography', category: 'geography' },
  { reason: 'Deal size outside buyer criteria', category: 'size' },
  { reason: 'Services not aligned', category: 'service' },
  { reason: 'Buyer not actively acquiring', category: 'timing' },
  { reason: 'Already in discussions', category: 'other' },
];

export const BulkActionsToolbar = ({
  selectedCount,
  onClearSelection,
  onBulkApprove,
  onBulkPass,
  onExportCSV,
  isProcessing = false,
}: BulkActionsToolbarProps) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isPassing, setIsPassing] = useState(false);

  const handleBulkApprove = async () => {
    setIsApproving(true);
    try {
      await onBulkApprove();
      toast.success(`Approved ${selectedCount} buyers`);
    } catch (error) {
      toast.error('Failed to approve buyers');
    } finally {
      setIsApproving(false);
    }
  };

  const handleBulkPass = async (reason: string, category: string) => {
    setIsPassing(true);
    try {
      await onBulkPass(reason, category);
      toast.success(`Passed on ${selectedCount} buyers`);
    } catch (error) {
      toast.error('Failed to pass on buyers');
    } finally {
      setIsPassing(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-20 bg-background border rounded-lg p-3 shadow-sm mb-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="text-sm font-medium">
          {selectedCount} selected
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="text-muted-foreground"
        >
          <XCircle className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {/* Approve All */}
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={handleBulkApprove}
          disabled={isProcessing || isApproving}
        >
          {isApproving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Approve All
        </Button>

        {/* Pass All with Reason Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              disabled={isProcessing || isPassing}
            >
              {isPassing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-1" />
              )}
              Pass All
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
              Select reason for passing:
            </p>
            <DropdownMenuSeparator />
            {passReasons.map(({ reason, category }) => (
              <DropdownMenuItem
                key={category}
                onClick={() => handleBulkPass(reason, category)}
              >
                {reason}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px bg-border" />

        {/* Export CSV */}
        <Button
          size="sm"
          variant="outline"
          onClick={onExportCSV}
          disabled={isProcessing}
        >
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>

        {/* Generate Emails (future feature) */}
        <Button
          size="sm"
          variant="outline"
          disabled
          className="opacity-50"
          title="Coming soon"
        >
          <Mail className="h-4 w-4 mr-1" />
          Generate Emails
        </Button>
      </div>
    </div>
  );
};

export default BulkActionsToolbar;
