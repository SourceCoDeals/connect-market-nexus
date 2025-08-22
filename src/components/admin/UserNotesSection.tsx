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
    <div className="border border-border/20 rounded-lg bg-background/50">
      <div className="p-3 border-b border-border/10">
        <div className="flex items-center justify-between">
          <h6 className="text-sm font-medium text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            General Notes {notes.length > 0 && `(${notes.length})`}
          </h6>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsCreating(true)}
            disabled={isCreating}
            className="text-xs h-6 px-2 hover:bg-muted/50 transition-colors"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Create new note */}
      {isCreating && (
        <div className="p-3 border-b border-border/10 bg-muted/20">
          <Textarea
            placeholder="Add a note about this user..."
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            className="text-xs min-h-[50px] resize-none mb-2 border-border/20"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleCreateNote}
              disabled={createNote.isPending || !newNoteText.trim()}
              className="text-xs h-6 px-3"
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsCreating(false);
                setNewNoteText('');
              }}
              className="text-xs h-6 px-2"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div className="max-h-48 overflow-y-auto">
        <div className="divide-y divide-border/10">
          {isLoading ? (
            <div className="text-xs text-muted-foreground p-3">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="text-xs text-muted-foreground/60 p-3 text-center">
              No notes yet
            </div>
          ) : (
            notes
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((note) => {
                const isRecent = Date.now() - new Date(note.created_at).getTime() < 24 * 60 * 60 * 1000;
                return (
                  <div 
                    key={note.id} 
                    className="group p-3 hover:bg-muted/30 transition-colors"
                  >
                    {editingNoteId === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editNoteText}
                          onChange={(e) => setEditNoteText(e.target.value)}
                          className="text-xs min-h-[40px] resize-none border-border/20"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateNote(note.id)}
                            disabled={updateNote.isPending || !editNoteText.trim()}
                            className="text-xs h-6 px-2"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEditing}
                            className="text-xs h-6 px-2"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-xs text-foreground leading-relaxed flex-1">{note.note_text}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing(note)}
                            className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
                          <span className="font-medium">{note.admin_name}</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                          {isRecent && <span className="text-primary text-[10px] font-medium ml-1">NEW</span>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}