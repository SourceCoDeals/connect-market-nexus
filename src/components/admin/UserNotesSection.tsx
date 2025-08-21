import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, X, User } from "lucide-react";
import { useUserNotes, useCreateUserNote, useDeleteUserNote } from "@/hooks/admin/use-user-notes";
import { format } from "date-fns";

interface UserNotesSectionProps {
  userId: string;
  userName: string;
}

export const UserNotesSection = ({ userId, userName }: UserNotesSectionProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState("");

  const { data: notes = [], isLoading } = useUserNotes(userId);
  const createNoteMutation = useCreateUserNote();
  const deleteNoteMutation = useDeleteUserNote();

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      await createNoteMutation.mutateAsync({
        userId,
        noteText: newNote.trim()
      });
      setNewNote("");
      setIsAdding(false);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleDeleteNote = (noteId: string) => {
    deleteNoteMutation.mutate(noteId);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <User size={14} />
          <span className="text-sm font-medium">User Notes</span>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-muted rounded w-3/4"></div>
          <div className="h-3 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User size={14} />
          <span className="text-sm font-medium">User Notes</span>
          <Badge variant="secondary" className="text-xs">
            {notes.length}
          </Badge>
        </div>
        {!isAdding && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsAdding(true)}
            className="h-6 px-2 text-xs"
          >
            <Plus size={12} className="mr-1" />
            Add
          </Button>
        )}
      </div>

      {/* Add new note */}
      {isAdding && (
        <div className="space-y-2 p-3 bg-muted/50 rounded-md border">
          <Textarea
            placeholder="Add a note (e.g., 'spoke to firm', 'platform fit', 'fund active')..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={2}
            className="text-sm resize-none"
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote.trim() || createNoteMutation.isPending}
              className="h-7 px-3 text-xs"
            >
              {createNoteMutation.isPending ? "Adding..." : "Add Note"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAdding(false);
                setNewNote("");
              }}
              className="h-7 px-3 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Existing notes */}
      {notes.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {notes.map((note) => (
            <div key={note.id} className="group relative p-2 bg-muted/30 rounded text-xs border">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-medium break-words">
                    "{note.note_text}"
                  </p>
                  <div className="mt-1 text-muted-foreground">
                    <span>{note.admin?.first_name} {note.admin?.last_name}</span>
                    <span className="mx-1">•</span>
                    <span>{format(new Date(note.created_at), 'MMM d, h:mm a')}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteNote(note.id)}
                  disabled={deleteNoteMutation.isPending}
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <X size={10} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && !isAdding && (
        <p className="text-xs text-muted-foreground italic">
          No notes for {userName} yet. Add one to share context with other admins.
        </p>
      )}
    </div>
  );
};
