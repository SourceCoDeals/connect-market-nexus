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
  Phone,
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
  onGenerateEmails?: () => void;
  onPushToDialer?: () => void;
  isProcessing?: boolean;
  activeTab?: string;
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
  onGenerateEmails,
  onPushToDialer,
  isProcessing = false,
  activeTab = 'all',
}: BulkActionsToolbarProps) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isPassing, setIsPassing] = useState(false);

  const handleBulkApprove = async () => {
    setIsApproving(true);
    try {
      await onBulkApprove();
      toast.success(`Marked ${selectedCount} buyers as interested`);
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border border-border rounded-xl px-4 py-3 shadow-lg flex items-center gap-4 min-w-[500px] max-w-[700px]">
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

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Approve Fit - shown on All Buyers tab */}
        {activeTab !== 'approved' && (
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
            Approve Fit
          </Button>
        )}

        {/* Not Interested */}
        <Button
          size="sm"
          variant="outline"
          className="text-amber-700 border-amber-200 hover:bg-amber-50"
          onClick={() => handleBulkPass('Not interested in this deal', 'other')}
          disabled={isProcessing || isPassing}
        >
          {isPassing ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <X className="h-4 w-4 mr-1" />
          )}
          Not Interested
        </Button>

        <div className="h-6 w-px bg-border" />

        {/* Export CSV */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onExportCSV}
          disabled={isProcessing}
          className="text-muted-foreground"
        >
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>

        {/* Generate Emails */}
        <Button
          size="sm"
          variant="ghost"
          disabled={isProcessing || !onGenerateEmails}
          onClick={onGenerateEmails}
          className="text-muted-foreground"
        >
          <Mail className="h-4 w-4 mr-1" />
          Emails
        </Button>

        {/* Push to Dialer */}
        {onPushToDialer && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onPushToDialer}
            disabled={isProcessing}
            className="text-muted-foreground"
          >
            <Phone className="h-4 w-4 mr-1" />
            Dialer
          </Button>
        )}

        <div className="h-6 w-px bg-border" />

        {/* Pass All with Reason - far right */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              disabled={isProcessing || isPassing}
            >
              <X className="h-4 w-4 mr-1" />
              Pass
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
              Select reason buyer declined:
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
      </div>
    </div>
  );
};

export default BulkActionsToolbar;