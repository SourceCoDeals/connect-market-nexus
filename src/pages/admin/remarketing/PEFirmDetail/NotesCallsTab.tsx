import { QueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FirefliesTranscriptSearch } from '@/components/buyers/FirefliesTranscriptSearch';

interface NotesCallsTabProps {
  firmId: string;
  firmName: string;
  firmWebsite: string | null;
  contacts: Array<{
    email: string | null;
  }>;
  transcripts: Array<{
    id: string;
    title: string | null;
    source: string | null;
    created_at: string | null;
    [key: string]: unknown;
  }>;
  queryClient: QueryClient;
}

export const NotesCallsTab = ({
  firmId,
  firmName,
  firmWebsite,
  contacts,
  transcripts,
  queryClient,
}: NotesCallsTabProps) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Find Call Transcripts</CardTitle>
          <CardDescription>
            Search your Fireflies call history to link firm-level conversations with {firmName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FirefliesTranscriptSearch
            buyerId={firmId}
            companyName={firmName || ''}
            peFirmName={firmName}
            platformWebsite={firmWebsite}
            contacts={contacts.filter((c) => c.email).map((c) => ({ email: c.email! }))}
            onTranscriptLinked={() => {
              queryClient.invalidateQueries({
                queryKey: ['remarketing', 'transcripts', firmId],
              });
            }}
          />
        </CardContent>
      </Card>

      {transcripts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Linked Transcripts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transcripts.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      {t.title || (t['file_name'] as string | undefined) || 'Transcript'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {t.source || 'manual'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString() : '\u2014'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
