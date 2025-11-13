import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface QuickNoteInputProps {
  onSubmit: (note: string) => void;
  onCancel: () => void;
}

export function QuickNoteInput({ onSubmit, onCancel }: QuickNoteInputProps) {
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    if (note.trim()) {
      onSubmit(note);
      setNote('');
    }
  };

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <Input
        autoFocus
        placeholder="Add a quick note..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSubmit();
          }
          if (e.key === 'Escape') {
            onCancel();
          }
        }}
        className="h-8 text-xs"
      />
      <div className="flex items-center gap-2">
        <Button 
          size="sm" 
          onClick={handleSubmit}
          disabled={!note.trim()}
          className="h-6 text-xs"
        >
          Save
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={onCancel}
          className="h-6 text-xs"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
