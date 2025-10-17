import { Building2 } from 'lucide-react';
import { FirmAgreementsTable } from '@/components/admin/firm-agreements/FirmAgreementsTable';

export default function FirmAgreements() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Firm Agreement Tracking</h1>
        </div>
        <p className="text-muted-foreground">
          Track NDA and Fee Agreement signatures across all firms on the marketplace
        </p>
      </div>

      <FirmAgreementsTable />
    </div>
  );
}
