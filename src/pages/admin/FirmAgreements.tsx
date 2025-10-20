import { Building2, Info } from 'lucide-react';
import { FirmAgreementsTable } from '@/components/admin/firm-agreements/FirmAgreementsTable';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export default function FirmAgreements() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Firm Agreement Tracking</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage NDA and Fee Agreement signatures across all firms
            </p>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-500/5 border-blue-500/20">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-500" />
        <AlertTitle className="text-blue-900 dark:text-blue-400 font-semibold">
          How Firm Agreement Syncing Works
        </AlertTitle>
        <AlertDescription className="text-blue-800/80 dark:text-blue-400/80 text-sm space-y-2 mt-2">
          <p>
            <strong className="text-blue-900 dark:text-blue-300">When you toggle a firm's agreement status:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>All members of the firm are automatically updated</li>
            <li>Their individual user profile toggles will reflect the change</li>
            <li>All connection requests for those users are synced</li>
            <li>All deals associated with those users are updated</li>
            <li>A log entry is created for audit tracking with firm ID reference</li>
          </ul>
          <p className="pt-1">
            <strong className="text-blue-900 dark:text-blue-300">Example:</strong> If you mark "West Edge Partners" Fee Agreement as signed, both John Doe and Jane Smith's fee agreement toggles will automatically turn on in User Management, and all their connection requests and deals will be updated.
          </p>
        </AlertDescription>
      </Alert>

      {/* Table */}
      <FirmAgreementsTable />
    </div>
  );
}
