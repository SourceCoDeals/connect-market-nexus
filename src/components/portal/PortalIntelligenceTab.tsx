import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, FileText, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  usePortalIntelligenceDocs,
  useDeleteIntelligenceDoc,
} from '@/hooks/portal/use-portal-intelligence';
import { AddIntelligenceDocDialog } from './AddIntelligenceDocDialog';
import type { IntelligenceDocType, PortalIntelligenceDoc } from '@/types/portal';

interface PortalIntelligenceTabProps {
  portalOrgId: string;
}

const DOC_TYPE_STYLES: Record<IntelligenceDocType, string> = {
  meeting_notes: 'bg-blue-100 text-blue-800',
  call_transcript: 'bg-purple-100 text-purple-800',
  general_notes: 'bg-gray-100 text-gray-700',
  pass_notes: 'bg-orange-100 text-orange-800',
  thesis_document: 'bg-green-100 text-green-800',
};

const DOC_TYPE_LABELS: Record<IntelligenceDocType, string> = {
  meeting_notes: 'Meeting Notes',
  call_transcript: 'Call Transcript',
  general_notes: 'General Notes',
  pass_notes: 'Pass Notes',
  thesis_document: 'Thesis Document',
};

function DocCard({ doc, portalOrgId }: { doc: PortalIntelligenceDoc; portalOrgId: string }) {
  const [expanded, setExpanded] = useState(false);
  const deleteMutation = useDeleteIntelligenceDoc();
  const content = doc.content ?? '';
  const isLong = content.length > 200;
  const displayContent = expanded ? content : content.slice(0, 200);

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn('text-[10px] shrink-0', DOC_TYPE_STYLES[doc.doc_type])}>
                {DOC_TYPE_LABELS[doc.doc_type]}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {format(new Date(doc.created_at), 'MMM d, yyyy')}
              </span>
            </div>
            <h4 className="text-sm font-semibold truncate">{doc.title}</h4>
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate({ id: doc.id, portalOrgId })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {content && (
          <div>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {displayContent}
              {isLong && !expanded && '...'}
            </p>
            {isLong && (
              <button
                type="button"
                className="mt-1 flex items-center gap-0.5 text-xs text-primary hover:underline"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    Show less <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    Show more <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PortalIntelligenceTab({ portalOrgId }: PortalIntelligenceTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: docs, isLoading } = usePortalIntelligenceDocs(portalOrgId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Intelligence &amp; Notes</h3>
        <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add Notes
        </Button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && docs?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mb-3" />
          <p className="text-sm font-medium">No intelligence docs yet</p>
          <p className="text-xs mt-1">
            Add meeting notes, call transcripts, or other documents to build buyer intelligence.
          </p>
        </div>
      )}

      {/* Doc list */}
      {!isLoading && docs && docs.length > 0 && (
        <div className="space-y-3">
          {docs.map((doc) => (
            <DocCard key={doc.id} doc={doc} portalOrgId={portalOrgId} />
          ))}
        </div>
      )}

      <AddIntelligenceDocDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        portalOrgId={portalOrgId}
      />
    </div>
  );
}
