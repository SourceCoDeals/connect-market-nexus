import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, AlertCircle, Plus, Edit, Save, X } from 'lucide-react';
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
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h6 className="text-sm font-medium text-foreground">General Notes - {userName}</h6>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCreating(true)}
            disabled={isCreating}
            className="text-xs h-6 px-2"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Note
          </Button>
        </div>

        {/* Create new note */}
        {isCreating && (
          <div className="mb-3 p-3 border rounded-lg bg-muted/30">
            <Textarea
              placeholder="Add a general note about this user..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              className="text-xs min-h-[80px] resize-none mb-2"
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

        {/* Notes list */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-xs text-muted-foreground italic">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No notes yet. Add one above.</div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="p-3 border rounded-lg bg-background">
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editNoteText}
                      onChange={(e) => setEditNoteText(e.target.value)}
                      className="text-xs min-h-[80px] resize-none"
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateNote(note.id)}
                        disabled={updateNote.isPending || !editNoteText.trim()}
                        className="text-xs h-6 px-2"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditing}
                        className="text-xs h-6 px-2"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-xs text-foreground flex-1">{note.note_text}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing(note)}
                        className="text-xs h-5 w-5 p-0 shrink-0"
                        title="Edit note"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      By {note.admin_name} • {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}