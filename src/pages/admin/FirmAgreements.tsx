import { Building2 } from 'lucide-react';
import { FirmAgreementsTable } from '@/components/admin/firm-agreements/FirmAgreementsTable';

export default function FirmAgreements() {
  return (
    <div className="container mx-auto py-8 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Firm Agreement Tracking</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage NDA and Fee Agreement signatures across all firms. Changes sync to all firm members automatically.
        </p>
      </div>

      {/* Table */}
      <FirmAgreementsTable />
    </div>
  );
}
