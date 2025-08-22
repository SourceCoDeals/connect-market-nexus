import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, Save, X } from 'lucide-react';
import { useUpdateDecisionNotes } from '@/hooks/admin/use-connection-notes';

interface DecisionNotesInlineProps {
  requestId: string;
  currentNotes?: string;
  isActive: boolean; // Only show when toggle is active
  label: string; // "approved", "rejected", "on_hold"
}

export function DecisionNotesInline({ 
  requestId, 
  currentNotes = '', 
  isActive,
  label
}: DecisionNotesInlineProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [noteText, setNoteText] = useState(currentNotes);
  const updateNotes = useUpdateDecisionNotes();

  useEffect(() => {
    setNoteText(currentNotes);
  }, [currentNotes]);

  if (!isActive) return null;

  const handleSave = async () => {
    await updateNotes.mutateAsync({ requestId, notes: noteText.trim() });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setNoteText(currentNotes);
    setIsEditing(false);
  };

  return (
    <div className="border border-border/30 rounded-md bg-background/30">
      {isEditing ? (
        <div className="p-3 space-y-3">
          <Textarea
            placeholder={`Add a note for this ${label} decision...`}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="text-xs min-h-[60px] resize-none border-border/40 bg-background focus:border-primary/40"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateNotes.isPending}
              className="text-xs h-7 px-3"
            >
              <Save className="h-3 w-3 mr-1.5" />
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              className="text-xs h-7 px-3"
            >
              <X className="h-3 w-3 mr-1.5" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {currentNotes ? (
                <p className="text-xs text-foreground leading-relaxed">{currentNotes}</p>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic">Add decision note...</p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              className="text-xs h-6 w-6 p-0 shrink-0 hover:bg-accent/50 transition-colors"
              title="Edit decision note"
            >
              <Edit3 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}