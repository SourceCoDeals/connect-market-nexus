
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "@/hooks/use-admin";
import { AlertCircle, RefreshCw, Building2, Loader2 } from "lucide-react";
import { UsersTable } from "@/components/admin/UsersTable";
import { MobileUsersTable } from "@/components/admin/MobileUsersTable";
import { User } from "@/types";
import { UserActions } from "@/components/admin/UserActions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRealtimeAdmin } from "@/hooks/use-realtime-admin";
import { EnhancedUserManagement } from "@/components/admin/EnhancedUserManagement";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNonMarketplaceUsers } from "@/hooks/admin/use-non-marketplace-users";
import { NonMarketplaceUsersTable } from "@/components/admin/NonMarketplaceUsersTable";
import { UserViewSwitcher } from "@/components/admin/UserViewSwitcher";
import { useMarkUsersViewed } from "@/hooks/admin/use-mark-users-viewed";
import { useOwnerLeads, useUpdateOwnerLeadStatus } from "@/hooks/admin/use-owner-leads";
import { useUpdateOwnerLeadNotes } from "@/hooks/admin/use-update-owner-lead-notes";
import { useMarkOwnerLeadsViewed } from "@/hooks/admin/use-mark-owner-leads-viewed";
import { OwnerLeadsStats } from "@/components/admin/OwnerLeadsStats";
import { OwnerLeadsFilters } from "@/components/admin/OwnerLeadsFilters";
import { OwnerLeadsTableContent } from "@/components/admin/OwnerLeadsTableContent";
import { OwnerLead } from "@/hooks/admin/use-owner-leads";

type PrimaryView = 'buyers' | 'owners';
type SecondaryView = 'marketplace' | 'non-marketplace';

const AdminUsers = () => {
  const { users } = useAdmin();
  const { data: usersData = [], isLoading, error, refetch } = users;
  const { data: nonMarketplaceUsers = [], isLoading: isLoadingNonMarketplace } = useNonMarketplaceUsers();
  const { data: ownerLeads = [], isLoading: isLoadingOwnerLeads } = useOwnerLeads();
  const updateOwnerStatus = useUpdateOwnerLeadStatus();
  const updateOwnerNotes = useUpdateOwnerLeadNotes();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isConnected } = useRealtimeAdmin();
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [filteredOwnerLeads, setFilteredOwnerLeads] = useState<OwnerLead[]>([]);
  const [primaryView, setPrimaryView] = useState<PrimaryView>('buyers');
  const [secondaryView, setSecondaryView] = useState<SecondaryView>('marketplace');
  const { markAsViewed: markUsersAsViewed } = useMarkUsersViewed();
  const { markAsViewed: markOwnerLeadsAsViewed } = useMarkOwnerLeadsViewed();

  // Mark users as viewed when component mounts
  useEffect(() => {
    markUsersAsViewed();
  }, []);

  // Mark owner leads as viewed when switching to owners view
  useEffect(() => {
    if (primaryView === 'owners') {
      markOwnerLeadsAsViewed();
    }
  }, [primaryView]);

  // Update filtered users when usersData changes
  useEffect(() => {
    setFilteredUsers(usersData);
  }, [usersData]);

  // Update filtered owner leads when ownerLeads changes
  useEffect(() => {
    setFilteredOwnerLeads(ownerLeads);
  }, [ownerLeads]);

  const {
    handleUserApproval,
    handleMakeAdmin,
    handleRevokeAdmin,
    handleDeleteUser,
    ApprovalEmailDialog,
    AdminDialog,
    RevokeAdminDialog,
    DeleteDialog,
    isLoading: isActionLoading
  } = UserActions({ onUserStatusUpdated: () => refetch() });
  
  useEffect(() => {
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error loading users',
        description: 'Failed to load user data. Please try refreshing the page.',
      });
    }
  }, [error, toast]);
  
  const handleRetry = () => {
    refetch();
    toast({
      title: 'Refreshing data',
      description: 'Reloading user data...',
    });
  };

  const approveUser = (user: User) => handleUserApproval(user);
  const makeAdmin = (user: User) => handleMakeAdmin(user);
  const revokeAdmin = (user: User) => handleRevokeAdmin(user);
  const deleteUser = (user: User) => handleDeleteUser(user);

  const handleOwnerStatusChange = (id: string, status: string) => {
    updateOwnerStatus.mutate({ id, status });
  };

  const handleOwnerNotesUpdate = (id: string, notes: string) => {
    updateOwnerNotes.mutate({ id, notes });
  };

  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-xl md:text-2xl font-bold mb-2">Error Loading Users</h2>
          <p className="text-muted-foreground text-center mb-6 max-w-md text-sm md:text-base">
            There was an error loading the user data. This might be due to a database connection issue or permissions problem.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isCurrentlyLoading = primaryView === 'buyers' ? isLoading : isLoadingOwnerLeads;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
              <p className="text-sm text-muted-foreground">
                {primaryView === 'buyers' 
                  ? 'Manage buyer registrations, approvals, and profile data'
                  : 'Manage owner/seller inquiries and leads'
                }
              </p>
            </div>
          </div>

          <Tabs defaultValue="users" className="mt-6">
            <TabsList className="h-auto p-0 bg-transparent border-0 gap-6">
              <TabsTrigger 
                value="users"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 pt-0 font-medium text-sm data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"
              >
                Users
              </TabsTrigger>
              <TabsTrigger 
                value="firms"
                asChild
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 pt-0 font-medium text-sm data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"
              >
                <Link to="/admin/firm-agreements" className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Firm Agreements
                </Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main content */}
      <div className="px-8 py-8">
        {/* View Switcher - FIXED POSITION */}
        <div className="mb-6">
          <UserViewSwitcher
            primaryView={primaryView}
            secondaryView={secondaryView}
            onPrimaryViewChange={setPrimaryView}
            onSecondaryViewChange={setSecondaryView}
            marketplaceCount={usersData.length}
            nonMarketplaceCount={nonMarketplaceUsers.length}
            ownerLeadsCount={ownerLeads.length}
          />
        </div>

        {/* Stats Section - CONSISTENT STRUCTURE */}
        <div className="mb-6">
          {primaryView === 'buyers' ? (
            <EnhancedUserManagement
              users={usersData}
              onApprove={approveUser}
              onMakeAdmin={makeAdmin}
              onRevokeAdmin={revokeAdmin}
              onDelete={deleteUser}
              isLoading={isLoading}
              onFilteredUsersChange={setFilteredUsers}
            />
          ) : (
            <div className="space-y-6">
              <OwnerLeadsStats leads={ownerLeads} />
              <OwnerLeadsFilters 
                leads={ownerLeads} 
                onFilteredLeadsChange={setFilteredOwnerLeads} 
              />
            </div>
          )}
        </div>

        {/* Table Container - SAME WRAPPER FOR ALL */}
        <div className="bg-card rounded-lg border overflow-hidden">
          {isCurrentlyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : primaryView === 'buyers' ? (
            secondaryView === 'marketplace' ? (
              isMobile ? (
                <div className="p-4">
                  <MobileUsersTable
                    users={filteredUsers}
                    onApprove={approveUser}
                    onMakeAdmin={makeAdmin}
                    onRevokeAdmin={revokeAdmin}
                    onDelete={deleteUser}
                    isLoading={isLoading}
                    onSendFeeAgreement={() => {}}
                    onSendNDAEmail={() => {}}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <UsersTable
                    users={filteredUsers}
                    onApprove={approveUser}
                    onMakeAdmin={makeAdmin}
                    onRevokeAdmin={revokeAdmin}
                    onDelete={deleteUser}
                    isLoading={isLoading}
                  />
                </div>
              )
            ) : (
              <NonMarketplaceUsersTable
                users={nonMarketplaceUsers}
                isLoading={isLoadingNonMarketplace}
                filters={{}}
              />
            )
          ) : filteredOwnerLeads.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No owner inquiries yet</h3>
              <p className="text-sm text-muted-foreground">
                Owner inquiries from the /sell form will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <OwnerLeadsTableContent
                leads={filteredOwnerLeads}
                onStatusChange={handleOwnerStatusChange}
                onNotesUpdate={handleOwnerNotesUpdate}
              />
            </div>
          )}
        </div>

        {/* Dialogs */}
        <ApprovalEmailDialog />
        <AdminDialog />
        <RevokeAdminDialog />
        <DeleteDialog />
      </div>
    </div>
  );
};

export default AdminUsers;
