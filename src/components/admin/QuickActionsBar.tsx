import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Zap,
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

export function QuickActionsBar({ requests: _requests, onBulkAction: _onBulkAction }: QuickActionsBarProps) {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showUndoDialog, setShowUndoDialog] = useState(false);

  const { bulkImport, isLoading } = useBulkDealImport();

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