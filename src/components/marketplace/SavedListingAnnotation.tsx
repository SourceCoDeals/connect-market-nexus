import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StickyNote, Pencil, Trash2, X, Check } from 'lucide-react';

interface SavedListingAnnotationProps {
  listingId: string;
  note: string;
  onSave: (listingId: string, note: string) => void;
  onDelete: (listingId: string) => void;
}

export function SavedListingAnnotation({
  listingId,
  note,
  onSave,
  onDelete,
}: SavedListingAnnotationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(note);

  const handleSave = () => {
    onSave(listingId, editValue.trim());
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(note);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="mt-2 space-y-1.5">
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.slice(0, 500))}
          placeholder="Add a private note (e.g., 'Revisit in Q2', 'Good recurring revenue model')"
          rows={2}
          className="text-xs resize-none"
          autoFocus
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{editValue.length}/500</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleCancel} className="h-6 px-2">
              <X className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              className="h-6 px-2 text-emerald-600"
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (note) {
    return (
      <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded text-xs text-amber-800 group relative">
        <div className="flex items-start gap-1.5">
          <StickyNote className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
          <p className="flex-1 line-clamp-2">{note}</p>
        </div>
        <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
          <button
            onClick={() => {
              setEditValue(note);
              setIsEditing(true);
            }}
            className="p-1 rounded hover:bg-amber-100"
          >
            <Pencil className="h-3 w-3 text-amber-600" />
          </button>
          <button onClick={() => onDelete(listingId)} className="p-1 rounded hover:bg-amber-100">
            <Trash2 className="h-3 w-3 text-amber-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
    >
      <StickyNote className="h-3 w-3" />
      Add note
    </button>
  );
}
