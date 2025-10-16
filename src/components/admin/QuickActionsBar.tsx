import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Users, 
  Mail, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  FileText,
  Shield,
  Trash2,
  Upload
} from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { BulkDealImportDialog } from "./BulkDealImportDialog";
import { ManualUndoImportDialog } from "./ManualUndoImportDialog";
import { useBulkDealImport } from "@/hooks/admin/use-bulk-deal-import";

interface QuickActionsBarProps {
  requests: AdminConnectionRequest[];
  onBulkAction?: (action: string, requestIds: string[]) => void;
}

export function QuickActionsBar({ requests, onBulkAction }: QuickActionsBarProps) {
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showUndoDialog, setShowUndoDialog] = useState(false);
  
  const { bulkImport, isLoading } = useBulkDealImport();

  // Calculate quick stats
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    needingNDA: requests.filter(r => !r.user?.nda_signed && r.status === 'pending').length,
    needingFee: requests.filter(r => !r.user?.fee_agreement_signed && r.status === 'pending').length,
    needingFollowup: requests.filter(r => !r.followed_up && r.status === 'approved').length
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-semibold">Quick Actions</span>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportDialog(true)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Bulk Import CSV
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUndoDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Undo Import
            </Button>
          </div>
        </div>
      </Card>

      <BulkDealImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onConfirm={bulkImport}
        isLoading={isLoading}
      />

      <ManualUndoImportDialog
        isOpen={showUndoDialog}
        onClose={() => setShowUndoDialog(false)}
      />
    </>
  );
}