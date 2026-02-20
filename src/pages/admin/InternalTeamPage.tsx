import { NonMarketplaceUsersTable } from "@/components/admin/NonMarketplaceUsersTable";
import { useNonMarketplaceUsers } from "@/hooks/admin/use-non-marketplace-users";

const InternalTeamPage = () => {
  const { data: nonMarketplaceUsers = [], isLoading } = useNonMarketplaceUsers();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Internal Team</h1>
            <p className="text-sm text-muted-foreground">Non-marketplace internal users and team members</p>
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

export default InternalTeamPage;
