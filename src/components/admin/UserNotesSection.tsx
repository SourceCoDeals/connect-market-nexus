import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Plus, Edit, Save, X } from 'lucide-react';
import { useUserNotes, useCreateUserNote, useUpdateUserNote, UserNote } from '@/hooks/admin/use-connection-notes';
import { formatDistanceToNow } from 'date-fns';

interface UserNotesSectionProps {
  userId: string;
  userName: string;
}

export function UserNotesSection({ userId, userName }: UserNotesSectionProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [editNoteText, setEditNoteText] = useState('');

  const { data: notes = [], isLoading } = useUserNotes(userId);
  const createNote = useCreateUserNote();
  const updateNote = useUpdateUserNote();

  const handleCreateNote = async () => {
    if (!newNoteText.trim()) return;
    
    await createNote.mutateAsync({ 
      userId, 
      noteText: newNoteText.trim() 
    });
    setNewNoteText('');
    setIsCreating(false);
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editNoteText.trim()) return;
    
    await updateNote.mutateAsync({ 
      noteId, 
      noteText: editNoteText.trim(),
      userId 
    });
    setEditingNoteId(null);
    setEditNoteText('');
  };

  const startEditing = (note: UserNote) => {
    setEditingNoteId(note.id);
    setEditNoteText(note.note_text);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditNoteText('');
  };

  return (
    <Card className="bg-gradient-to-br from-card/50 to-muted/20 border border-border/50">
      <CardContent className="p-4">
        {/* Header with notes count */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-primary/10">
              <FileText className="h-3 w-3 text-primary" />
            </div>
            <h6 className="text-sm font-medium text-foreground">
              General Notes - {userName} {notes.length > 0 && `(${notes.length})`}
            </h6>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCreating(true)}
            disabled={isCreating}
            className="text-xs h-7 px-3 transition-all hover:scale-105"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Note
          </Button>
        </div>

        {/* Create new note - Always visible when creating */}
        {isCreating && (
          <div className="mb-3 p-3 border rounded-lg bg-muted/50 backdrop-blur-sm">
            <Textarea
              placeholder="Add a general note about this user..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              className="text-xs min-h-[60px] resize-none mb-2 bg-background/80"
            />
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                onClick={handleCreateNote}
                disabled={createNote.isPending || !newNoteText.trim()}
                className="text-xs h-6 px-2"
              >
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setNewNoteText('');
                }}
                className="text-xs h-6 px-2"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Notes list with fixed height and scrolling */}
        <div className="max-h-[300px] overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-2">
              {isLoading ? (
                <div className="text-xs text-muted-foreground italic p-2">Loading notes...</div>
              ) : notes.length === 0 ? (
                <div className="text-xs text-muted-foreground italic p-2 text-center bg-muted/30 rounded border border-dashed">
                  No notes yet. Add one above to get started.
                </div>
              ) : (
                notes
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((note, index) => {
                    const isRecent = Date.now() - new Date(note.created_at).getTime() < 24 * 60 * 60 * 1000;
                    return (
                      <div 
                        key={note.id} 
                        className={`p-2 border rounded-lg bg-background/80 backdrop-blur-sm transition-all hover:shadow-sm ${
                          isRecent ? 'border-primary/20 bg-primary/5' : 'border-border/50'
                        }`}
                      >
                        {editingNoteId === note.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                              className="text-xs min-h-[60px] resize-none bg-background"
                            />
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                onClick={() => handleUpdateNote(note.id)}
                                disabled={updateNote.isPending || !editNoteText.trim()}
                                className="text-xs h-5 px-2"
                              >
                                <Save className="h-2 w-2 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditing}
                                className="text-xs h-5 px-2"
                              >
                                <X className="h-2 w-2 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-xs text-foreground flex-1 leading-relaxed">{note.note_text}</p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditing(note)}
                                className="text-xs h-4 w-4 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                                title="Edit note"
                              >
                                <Edit className="h-2 w-2" />
                              </Button>
                            </div>
                            <div className={`text-xs ${isRecent ? 'text-primary/80' : 'text-muted-foreground'} flex items-center gap-1`}>
                              <span className="font-medium">{note.admin_name}</span>
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                              {isRecent && <span className="text-primary text-[10px] font-medium ml-1">NEW</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}