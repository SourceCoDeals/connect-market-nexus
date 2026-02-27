/**
 * DealTeamPanel — Manage deal team membership for a listing.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Plus, X, UserRound } from 'lucide-react';
import {
  useDealTeam,
  useAddDealTeamMember,
  useUpdateDealTeamRole,
  useRemoveDealTeamMember,
} from '@/hooks/useDealTeam';
import { useToast } from '@/hooks/use-toast';
import type { DealTeamRole } from '@/types/daily-tasks';

const ROLE_LABELS: Record<DealTeamRole, string> = {
  lead: 'Lead',
  analyst: 'Analyst',
  support: 'Support',
};

interface DealTeamPanelProps {
  listingId: string;
  teamMembers: { id: string; name: string }[];
}

export function DealTeamPanel({ listingId, teamMembers }: DealTeamPanelProps) {
  const { data: dealTeam, isLoading } = useDealTeam(listingId);
  const addMember = useAddDealTeamMember();
  const updateRole = useUpdateDealTeamRole();
  const removeMember = useRemoveDealTeamMember();
  const { toast } = useToast();

  const [addingUserId, setAddingUserId] = useState('');
  const [addingRole, setAddingRole] = useState<DealTeamRole>('analyst');

  const existingUserIds = new Set((dealTeam || []).map((m) => m.user_id));
  const availableMembers = teamMembers.filter((m) => !existingUserIds.has(m.id));

  const handleAdd = async () => {
    if (!addingUserId) return;
    try {
      await addMember.mutateAsync({
        listingId,
        userId: addingUserId,
        role: addingRole,
      });
      setAddingUserId('');
      setAddingRole('analyst');
    } catch (err) {
      toast({
        title: 'Failed to add team member',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleRoleChange = async (memberId: string, newRole: DealTeamRole) => {
    try {
      await updateRole.mutateAsync({ memberId, listingId, role: newRole });
    } catch (err) {
      toast({
        title: 'Failed to update role',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      await removeMember.mutateAsync({ memberId, listingId });
    } catch (err) {
      toast({
        title: 'Failed to remove member',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Deal Team
        </h4>
        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
          {dealTeam?.length || 0}
        </Badge>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <>
          {/* Current members */}
          <div className="space-y-1.5">
            {(dealTeam || []).map((member) => {
              const name = member.user
                ? `${member.user.first_name || ''} ${member.user.last_name || ''}`.trim() ||
                  member.user.email
                : member.user_id.slice(0, 8);

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-md border px-3 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={member.role}
                      onValueChange={(v) => handleRoleChange(member.id, v as DealTeamRole)}
                    >
                      <SelectTrigger className="h-6 w-24 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(ROLE_LABELS) as [DealTeamRole, string][]).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemove(member.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add member */}
          {availableMembers.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={addingUserId} onValueChange={setAddingUserId}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Add team member..." />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={addingRole} onValueChange={(v) => setAddingRole(v as DealTeamRole)}>
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_LABELS) as [DealTeamRole, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleAdd}
                disabled={!addingUserId || addMember.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
