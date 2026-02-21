import { NonMarketplaceUsersTable } from "@/components/admin/NonMarketplaceUsersTable";
import { useNonMarketplaceUsers } from "@/hooks/admin/use-non-marketplace-users";

/**
 * Non-marketplace buyer contacts page.
 * Shows people who submitted connection requests, inbound leads, or were
 * added as deal contacts but never created a SourceCo marketplace account.
 *
 * Relocated from /admin/settings/team (where it was incorrectly labeled
 * as "Internal Team") to /admin/buyers/contacts.
 */
const BuyerContactsPage = () => {
  const { data: nonMarketplaceUsers = [], isLoading } = useNonMarketplaceUsers();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Buyer Contacts</h1>
            <p className="text-sm text-muted-foreground">
              Non-marketplace contacts from connection requests, inbound leads, and deal contacts.
            </p>
          </div>
        </div>
      </div>
      <div className="px-8 py-8">
        <div className="bg-card rounded-lg border overflow-hidden">
          <NonMarketplaceUsersTable
            users={nonMarketplaceUsers}
            isLoading={isLoading}
            filters={{}}
          />
        </div>
      </div>
    </div>
  );
};

export default BuyerContactsPage;
