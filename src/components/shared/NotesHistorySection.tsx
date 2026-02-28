import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  Loader2,
  Send,
  Trash2,
  StickyNote,
} from 'lucide-react';
import { format } from 'date-fns';
import { useNotesHistory, type EntityNote } from '@/hooks/useNotesHistory';

interface NotesHistorySectionProps {
  entityType: 'deal' | 'buyer';
  entityId: string;
  defaultOpen?: boolean;
}

export function NotesHistorySection({
  entityType,
  entityId,
  defaultOpen = false,
}: NotesHistorySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [newNote, setNewNote] = useState('');
  const { notes, isLoading, addNote, deleteNote } = useNotesHistory(entityType, entityId);

  const handleSubmit = () => {
    const text = newNote.trim();
    if (!text) return;
    addNote.mutate(text, {
      onSuccess: () => setNewNote(''),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquarePlus className="h-5 w-5" />
                Notes History
                {notes.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({notes.length})
                  </span>
                )}
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* New note input */}
            <div className="space-y-2">
              <Textarea
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[80px] resize-y"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Press Ctrl+Enter to save</p>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!newNote.trim() || addNote.isPending}
                >
                  {addNote.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1.5" />
                  )}
                  Save Note
                </Button>
              </div>
            </div>

            <Separator />

            {/* Notes list */}
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading notes...
              </div>
            ) : notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <StickyNote className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No notes yet</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3 pr-3">
                  {notes.map((note: EntityNote) => (
                    <NoteItem
                      key={note.id}
                      note={note}
                      onDelete={() => deleteNote.mutate(note.id)}
                      isDeleting={deleteNote.isPending}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function NoteItem({
  note,
  onDelete,
  isDeleting,
}: {
  note: EntityNote;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="group rounded-lg border bg-muted/30 p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{note.author_name}</span>
          <span>&middot;</span>
          <span>{format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
    </div>
  );
}

export default NotesHistorySection;
