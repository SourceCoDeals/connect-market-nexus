import { Card, CardContent } from '@/components/ui/card';
import { FileText, AlertCircle } from 'lucide-react';

interface UserNotesSectionProps {
  userId: string;
  userName: string;
}

export function UserNotesSection({ userId, userName }: UserNotesSectionProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h6 className="text-sm font-medium text-foreground">General Notes - {userName}</h6>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Notes feature is being set up. Use admin comments in the connection request for now.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}