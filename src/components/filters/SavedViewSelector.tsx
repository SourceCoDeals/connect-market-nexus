import { useState } from "react";
import { Bookmark, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SavedView } from "@/hooks/use-saved-views";
import type { FilterState } from "./filter-definitions";

interface SavedViewSelectorProps {
  views: SavedView[];
  onSelect: (view: SavedView) => void;
  onSave: (name: string, filters: FilterState) => void;
  onDelete: (id: string) => void;
  currentFilters: FilterState;
}

export function SavedViewSelector({
  views,
  onSelect,
  onSave,
  onDelete,
  currentFilters,
}: SavedViewSelectorProps) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleSave = () => {
    if (!newName.trim()) return;
    onSave(newName.trim(), currentFilters);
    setNewName("");
    setShowSaveInput(false);
  };

  const hasActiveFilters =
    currentFilters.rules.length > 0 || currentFilters.search;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-sm px-2.5">
          <Bookmark className="h-3.5 w-3.5 mr-1.5" />
          Views
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-3" align="end">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Saved Views
          </div>

          {views.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No saved views yet.
            </p>
          )}

          {views.map((view) => (
            <div
              key={view.id}
              className="flex items-center justify-between group rounded-md hover:bg-muted/50 px-2 py-1.5 cursor-pointer"
              onClick={() => {
                onSelect(view);
                setOpen(false);
              }}
            >
              <span className="text-sm truncate">{view.name}</span>
              <button
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(view.id);
                }}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))}

          {hasActiveFilters && (
            <div className="border-t pt-2 mt-2">
              {showSaveInput ? (
                <div className="flex gap-1.5">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="View name..."
                    className="h-7 text-xs"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  />
                  <Button size="sm" className="h-7 text-xs px-2" onClick={handleSave}>
                    Save
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs justify-start"
                  onClick={() => setShowSaveInput(true)}
                >
                  <Plus className="h-3 w-3 mr-1.5" />
                  Save current filters
                </Button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
