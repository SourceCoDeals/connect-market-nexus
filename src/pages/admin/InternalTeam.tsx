import { useNonMarketplaceUsers } from "@/hooks/admin/use-non-marketplace-users";
import { NonMarketplaceUsersTable } from "@/components/admin/NonMarketplaceUsersTable";

const InternalTeam = () => {
  const { data: nonMarketplaceUsers = [], isLoading: isLoadingNonMarketplace } = useNonMarketplaceUsers();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Internal Users & Team</h1>
            <p className="text-sm text-muted-foreground">
              Manage SourceCo team members with platform access. Invite, edit roles, and manage permissions.
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 py-8">
        <div className="bg-card rounded-lg border overflow-hidden">
          <NonMarketplaceUsersTable
            users={nonMarketplaceUsers}
            isLoading={isLoadingNonMarketplace}
            filters={{}}
          />
        </div>
      </div>
    </div>
  );
};

export default InternalTeam;
