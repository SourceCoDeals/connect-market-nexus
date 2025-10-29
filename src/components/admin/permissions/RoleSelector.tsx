import { useState } from 'react';
import { AppRole } from '@/hooks/permissions/usePermissions';
import { useRoleManagement } from '@/hooks/permissions/useRoleManagement';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RoleBadge } from './RoleBadge';

interface RoleSelectorProps {
  userId: string;
  currentRole: AppRole;
  userEmail: string;
  disabled?: boolean;
}

const roleOptions: { value: AppRole; label: string; description: string }[] = [
  { value: 'owner', label: 'Owner', description: 'Full system access (restricted)' },
  { value: 'admin', label: 'Admin', description: 'Administrative access' },
  { value: 'user', label: 'User', description: 'Standard access' },
];

export const RoleSelector = ({ userId, currentRole, userEmail, disabled }: RoleSelectorProps) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [reason, setReason] = useState('');
  const { updateUserRole, isUpdating } = useRoleManagement();

  const handleRoleChange = (newRole: string) => {
    setSelectedRole(newRole as AppRole);
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedRole) return;

    updateUserRole({
      targetUserId: userId,
      newRole: selectedRole,
      reason: reason.trim() || undefined,
    });

    setIsConfirmOpen(false);
    setReason('');
    setSelectedRole(null);
  };

  const handleCancel = () => {
    setIsConfirmOpen(false);
    setSelectedRole(null);
    setReason('');
  };

  return (
    <>
      <Select
        value={currentRole}
        onValueChange={handleRoleChange}
        disabled={disabled || isUpdating}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue>
            <RoleBadge role={currentRole} showTooltip={false} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {roleOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.value === 'owner'}
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription>
              You are about to change the role for <strong>{userEmail}</strong> from{' '}
              <RoleBadge role={currentRole} showTooltip={false} /> to{' '}
              {selectedRole && <RoleBadge role={selectedRole} showTooltip={false} />}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Why are you changing this user's role?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isUpdating}>
              {isUpdating ? 'Updating...' : 'Confirm Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
