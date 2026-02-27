import { CheckCircle2, XCircle, AlertTriangle, Loader2, SkipForward } from 'lucide-react';
import { type AnyTestStatus } from './helpers';

export function StatusIcon({ status }: { status: AnyTestStatus }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'fail':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'warn':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case 'skip':
      return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    default:
      return <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />;
  }
}
