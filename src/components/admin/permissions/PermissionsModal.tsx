import { useState } from 'react';
import { useAdmin } from '@/hooks/admin';
import { useRoleManagement } from '@/hooks/permissions/useRoleManagement';
import { User } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, History, Users } from 'lucide-react';
import { TeamMemberCard } from './TeamMemberCard';
import { PermissionAuditLog } from './PermissionAuditLog';
import { Skeleton } from '@/components/ui/skeleton';
import { AppRole } from '@/hooks/permissions/usePermissions';

interface PermissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PermissionsModal = ({ open, onOpenChange }: PermissionsModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { users: usersQuery } = useAdmin();
  const { allUserRoles, isLoadingRoles, auditLog } = useRoleManagement();

  const users = usersQuery.data;
  const isLoadingUsers = usersQuery.isLoading;

  const filteredUsers = users?.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower)
    );
  });

  const getUserRole = (userId: string): AppRole => {
    return (allUserRoles?.find((ur) => ur.user_id === userId)?.role as AppRole) || 'user';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Team Permissions
          </DialogTitle>
          <DialogDescription>
            Manage user roles and permissions across your organization
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="team" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              Team Members
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <History className="h-4 w-4" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="flex-1 flex flex-col overflow-hidden space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {isLoadingUsers || isLoadingRoles ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </>
              ) : (
                <>
                  {filteredUsers?.map((user) => (
                    <TeamMemberCard
                      key={user.id}
                      user={user}
                      role={getUserRole(user.id)}
                    />
                  ))}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="audit" className="flex-1 overflow-hidden mt-4">
            <PermissionAuditLog auditLog={auditLog || []} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
