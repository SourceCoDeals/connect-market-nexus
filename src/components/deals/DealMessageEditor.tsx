import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DealMessageEditorProps {
  requestId: string;
  initialMessage: string;
  onMessageUpdate: (newMessage: string) => Promise<void>;
  className?: string;
}

export function DealMessageEditor({ 
  requestId, 
  initialMessage, 
  onMessageUpdate,
  className 
}: DealMessageEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a message before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await onMessageUpdate(message);
      setIsEditing(false);
      toast({
        title: "Message updated",
        description: "Your message has been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Failed to update",
        description: "There was an error updating your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setMessage(initialMessage);
    setIsEditing(false);
  };

  return (
    <div className={cn("relative", className)}>
      {!isEditing ? (
        <button
          onClick={() => setIsEditing(true)}
          className="group w-full text-left border-b border-gray-200 hover:border-gray-400 pb-3 transition-colors duration-200"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-gray-700 leading-relaxed flex-1 break-words overflow-wrap-anywhere">
              {message || 'Click to add a message'}
            </p>
            <Pencil className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-700 transition-colors shrink-0" />
          </div>
        </button>
      ) : (
        <div className="space-y-3 animate-in fade-in-0 duration-200">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your message..."
            className="min-h-[120px] resize-none border-slate-200 bg-white shadow-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all duration-200"
            autoFocus
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                handleSave();
              } else if (e.key === 'Escape') {
                handleCancel();
              }
            }}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors duration-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !message.trim()}
              className="h-7 px-3 text-xs bg-slate-900 hover:bg-slate-800 transition-colors duration-200"
            >
              {isSaving ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Save
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
