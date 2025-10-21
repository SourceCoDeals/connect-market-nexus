import { User } from '@/types';
import { AppRole } from '@/hooks/permissions/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RoleBadge } from './RoleBadge';
import { RoleSelector } from './RoleSelector';
import { formatDistanceToNow } from 'date-fns';

interface TeamMemberCardProps {
  user: User;
  role: AppRole;
}

export const TeamMemberCard = ({ user, role }: TeamMemberCardProps) => {
  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || user.email[0].toUpperCase();
  
  const isOwner = user.email === 'ahaile14@gmail.com';
  
  // Display "Admin" for owner to keep professional appearance
  const displayRole = isOwner ? 'admin' : role;

  return (
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
              
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
              
              {user.company && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {user.company}
                </p>
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
              disabled={isOwner}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
