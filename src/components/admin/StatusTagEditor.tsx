import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { X, Edit3, Trash2 } from "lucide-react";

interface StatusTagEditorProps {
  currentStatus: string | null;
  onStatusChange: (status: string | null) => void;
  className?: string;
}

const STATUS_OPTIONS = [
  { value: "just_listed", label: "Just Listed" },
  { value: "reviewing_buyers", label: "Reviewing Buyers" },
  { value: "in_diligence", label: "In Diligence" },
  { value: "under_loi", label: "Under LOI" },
  { value: "accepted_offer", label: "Accepted Offer" },
];

export function StatusTagEditor({ currentStatus, onStatusChange, className }: StatusTagEditorProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (!isEditing) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className="h-6 w-6 p-0 hover:bg-white/20 absolute top-2 right-2 z-20"
          >
            <Edit3 className="h-3 w-3 text-white" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem 
            onClick={() => onStatusChange(null)}
            className="text-destructive"
          >
            <X className="h-4 w-4 mr-2" />
            Remove Status Tag
          </DropdownMenuItem>
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuItem 
              key={option.value}
              onClick={() => onStatusChange(option.value)}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="absolute top-2 right-2 z-20 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border">
      <Select value={currentStatus || ""} onValueChange={(value) => {
        onStatusChange(value === "" ? null : value);
        setIsEditing(false);
      }}>
        <SelectTrigger className="w-40 h-8">
          <SelectValue placeholder="Set status..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">No Status</SelectItem>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsEditing(false)}
        className="mt-1 h-6 w-full text-xs"
      >
        Cancel
      </Button>
    </div>
  );
}