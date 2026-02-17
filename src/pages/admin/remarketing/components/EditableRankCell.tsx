import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const EditableRankCell = ({ value, onSave }: { value: number; onSave: (v: number) => Promise<void> | void }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.select(), 0); }, [open]);

  const handleSave = async () => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed !== value) {
      setSaving(true);
      await onSave(parsed);
      setSaving(false);
    } else {
      setDraft(String(value));
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { if (!v) { setDraft(String(value)); setOpen(false); } else { setOpen(true); } }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="group/rank relative font-semibold tabular-nums text-muted-foreground min-w-[28px] h-7 inline-flex items-center justify-center rounded-md border border-transparent hover:border-border hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all duration-150"
          title="Click to edit position"
        >
          {value}
          <span className="absolute -top-1 -right-1 opacity-0 group-hover/rank:opacity-100 transition-opacity">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="text-muted-foreground">
              <path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3 z-50"
        align="start"
        side="bottom"
        sideOffset={4}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">Edit Position</label>
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              type="number"
              min={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                if (e.key === 'Escape') { setDraft(String(value)); setOpen(false); }
              }}
              className="w-20 h-8 text-center text-sm font-semibold tabular-nums px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <Button size="sm" className="h-8 px-3" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
