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
    <div className="mt-2 p-2 bg-muted/30 rounded border">
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            placeholder={`Add a note for this ${label} decision...`}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="text-xs min-h-[50px] resize-none"
          />
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateNotes.isPending}
              className="text-xs h-6 px-2"
            >
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              className="text-xs h-6 px-2"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {currentNotes ? (
              <p className="text-xs text-foreground mb-1">{currentNotes}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">No decision note</p>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="text-xs h-5 w-5 p-0 shrink-0"
            title="Edit decision note"
          >
            <Edit3 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}