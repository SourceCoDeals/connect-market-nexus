
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "@/hooks/use-admin";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, AlertCircle, RefreshCw, Building2, Settings } from "lucide-react";
import { UsersTable } from "@/components/admin/UsersTable";
import { MobileUsersTable } from "@/components/admin/MobileUsersTable";
import { User } from "@/types";
import { UserActions } from "@/components/admin/UserActions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRealtimeAdmin } from "@/hooks/use-realtime-admin";
import { EnhancedUserManagement } from "@/components/admin/EnhancedUserManagement";
import { BulkVerificationEmailSender } from "@/components/admin/BulkVerificationEmailSender";
import { ProfileDataInspector } from "@/components/admin/ProfileDataInspector";
import { ProfileDataRecovery } from "@/components/admin/ProfileDataRecovery";
import { AutomatedDataRestoration } from "@/components/admin/AutomatedDataRestoration";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";



const AdminUsers = () => {
  const { users } = useAdmin();
  const { data: usersData = [], isLoading, error, refetch } = users;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isConnected } = useRealtimeAdmin(); // Enable real-time updates
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);

  // Update filtered users when usersData changes
  useEffect(() => {
    setFilteredUsers(usersData);
  }, [usersData]);

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
  
  // Handle errors and show user feedback
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
  


  // User action handlers
  const approveUser = (user: User) => handleUserApproval(user);
  const makeAdmin = (user: User) => handleMakeAdmin(user);
  const revokeAdmin = (user: User) => handleRevokeAdmin(user);
  const deleteUser = (user: User) => handleDeleteUser(user);

  // Error state with better UX
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

  return (
    <div className="min-h-screen bg-background">
      {/* Stripe-style header with generous padding */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
              <p className="text-sm text-muted-foreground">
                Manage user registrations, approvals, and profile data
              </p>
            </div>
            
          </div>

          {/* Subtle navigation tabs */}
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

      {/* Main content with generous padding */}
      <div className="px-8 py-8">
        <EnhancedUserManagement
          users={usersData}
          onApprove={approveUser}
          onMakeAdmin={makeAdmin}
          onRevokeAdmin={revokeAdmin}
          onDelete={deleteUser}
          isLoading={isLoading}
          onFilteredUsersChange={setFilteredUsers}
        />

        {/* Users Table */}
        <div className="mt-8 bg-card rounded-lg border overflow-hidden">
          {isMobile ? (
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
          )}
        </div>

        {/* All user action dialogs */}
        <ApprovalEmailDialog />
        <AdminDialog />
        <RevokeAdminDialog />
        <DeleteDialog />
      </div>
    </div>
  );
};


export default AdminUsers;
