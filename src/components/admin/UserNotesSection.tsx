import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Edit3, Plus, Save, X, FileText } from 'lucide-react';
import { useUserNotes, useCreateUserNote, useUpdateUserNote, UserNote } from '@/hooks/admin/use-connection-notes';
import { formatDistanceToNow } from 'date-fns';

interface UserNotesSectionProps {
  userId: string;
  userName: string;
}

export function UserNotesSection({ userId, userName }: UserNotesSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [editNoteText, setEditNoteText] = useState('');

  const { data: notes = [], isLoading } = useUserNotes(userId);
  const createNote = useCreateUserNote();
  const updateNote = useUpdateUserNote();

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;
    
    await createNote.mutateAsync({ userId, noteText: newNoteText.trim() });
    setNewNoteText('');
    setIsAdding(false);
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editNoteText.trim()) return;
    
    await updateNote.mutateAsync({ noteId, noteText: editNoteText.trim(), userId });
    setEditingId(null);
    setEditNoteText('');
  };

  const startEditing = (note: UserNote) => {
    setEditingId(note.id);
    setEditNoteText(note.note_text);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditNoteText('');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-3 bg-muted rounded w-full"></div>
            <div className="h-3 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

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
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
            className="text-xs h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Note
          </Button>
        </div>

        {/* Add new note */}
        {isAdding && (
          <div className="mb-3 p-3 border rounded-lg bg-muted/30">
            <Textarea
              placeholder="Add a general note (e.g., 'spoke to firm', 'platform fit', 'fund active')..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              className="mb-2 text-sm min-h-[60px]"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!newNoteText.trim() || createNote.isPending}
                className="text-xs h-7"
              >
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setNewNoteText('');
                }}
                className="text-xs h-7"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Existing notes */}
        {notes.length === 0 && !isAdding ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No general notes yet. Add one to track interactions with this user.
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="p-3 border rounded-lg bg-card/50">
                {editingId === note.id ? (
                  <div>
                    <Textarea
                      value={editNoteText}
                      onChange={(e) => setEditNoteText(e.target.value)}
                      className="mb-2 text-sm min-h-[60px]"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateNote(note.id)}
                        disabled={!editNoteText.trim() || updateNote.isPending}
                        className="text-xs h-7"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditing}
                        className="text-xs h-7"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm text-foreground flex-1">{note.note_text}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing(note)}
                        className="text-xs h-6 w-6 p-0 shrink-0"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {note.admin_name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
