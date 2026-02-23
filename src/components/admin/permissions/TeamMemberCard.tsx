import { useState } from 'react';
import { User } from '@/types';
import { AppRole } from '@/hooks/permissions/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RoleBadge } from './RoleBadge';
import { RoleSelector } from './RoleSelector';
import { formatDistanceToNow } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { MoreVertical, KeyRound, Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TeamMemberCardProps {
  user: User;
  role: AppRole;
}

export const TeamMemberCard = ({ user, role }: TeamMemberCardProps) => {
  const [sendingReset, setSendingReset] = useState(false);
  const [manualResetOpen, setManualResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleSendPasswordReset = async () => {
    if (!user.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.functions.invoke('password-reset', {
        body: { email: user.email, action: 'request' },
      });
      if (error) throw error;
      toast.success(`Password reset link sent to ${user.email}`);
    } catch (err: any) {
      console.error('Failed to send password reset:', err);
      toast.error('Failed to send password reset link');
    } finally {
      setSendingReset(false);
    }
  };

  const handleManualReset = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setResettingPassword(true);
    try {
      const { error } = await supabase.functions.invoke('admin-reset-password', {
        body: { userId: user.id, newPassword },
      });
      if (error) throw error;
      toast.success(`Password updated for ${user.email}`);
      setManualResetOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Failed to reset password:', err);
      toast.error('Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || (user.email?.[0] || '?').toUpperCase();
  const displayRole = role === 'owner' ? 'admin' : role;

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Avatar className="h-12 w-12 ring-2 ring-primary/10">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm truncate">
                    {user.first_name && user.last_name
                      ? `${user.first_name} ${user.last_name}`
                      : user.email}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                {user.company && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{user.company}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Joined {formatDistanceToNow(new Date(user.created_at))} ago
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <RoleBadge role={displayRole as AppRole} />
              </div>
              <RoleSelector
                userId={user.id}
                currentRole={role}
                userEmail={user.email}
                disabled={role === 'owner'}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSendPasswordReset} disabled={sendingReset}>
                    {sendingReset ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4 mr-2" />
                    )}
                    Send Password Reset Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setManualResetOpen(true)}>
                    <Lock className="h-4 w-4 mr-2" />
                    Set Password Manually
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={manualResetOpen} onOpenChange={(open) => {
        setManualResetOpen(open);
        if (!open) { setNewPassword(''); setConfirmPassword(''); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Password Manually</DialogTitle>
            <DialogDescription>
              Set a new password for <span className="font-medium">{user.email}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualResetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualReset} disabled={resettingPassword || !newPassword || !confirmPassword}>
              {resettingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
