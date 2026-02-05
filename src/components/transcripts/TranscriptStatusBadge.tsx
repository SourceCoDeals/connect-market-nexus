import { Badge } from '@/components/ui/badge';

interface TranscriptStatusBadgeProps {
  processedAt?: string | null;
  extractionStatus?: string | null;
}

export function TranscriptStatusBadge({ processedAt, extractionStatus }: TranscriptStatusBadgeProps) {
  if (!processedAt) {
    return <Badge variant="outline">Pending</Badge>;
  }

  switch (extractionStatus) {
    case 'completed':
      return <Badge variant="success">Completed</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'processing':
      return <Badge variant="secondary">Processing</Badge>;
    case 'insufficient_data':
      return <Badge variant="outline">Insufficient Data</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}
