import { formatDistanceToNow } from 'date-fns';
import { AppRole } from '@/hooks/permissions/usePermissions';
import { RoleBadge } from './RoleBadge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Clock, History as HistoryIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AuditLogEntry {
  id: string;
  target_email: string;
  target_name: string;
  changer_email: string;
  changer_name: string;
  old_role: AppRole | null;
  new_role: AppRole;
  reason: string | null;
  created_at: string;
}

interface PermissionAuditLogProps {
  auditLog: AuditLogEntry[];
}

export const PermissionAuditLog = ({ auditLog }: PermissionAuditLogProps) => {
  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-3">
        {auditLog.map((entry) => (
          <Card key={entry.id} className="border-border/50 hover:border-border transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm truncate">
                        {entry.target_name}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        ({entry.target_email})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      {entry.old_role && <RoleBadge role={entry.old_role} showTooltip={false} />}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <RoleBadge role={entry.new_role} showTooltip={false} />
                    </div>

                    {entry.reason && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        "{entry.reason}"
                      </p>
                    )}

                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(entry.created_at))} ago
                      </div>
                      <div>
                        Changed by: <span className="font-medium">{entry.changer_name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {auditLog.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <HistoryIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No permission changes recorded yet</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};
