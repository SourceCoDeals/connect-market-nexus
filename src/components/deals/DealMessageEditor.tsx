import { useState } from "react";
import { MessageSquare, Edit3, Check, X } from "lucide-react";
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
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-medium text-slate-900">Your message</h3>
        </div>
        
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors group"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[120px] text-sm resize-none border-slate-200 focus-visible:ring-slate-900"
            placeholder="Enter your message to the business owner..."
          />
          
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="h-8 px-3 text-xs bg-slate-900 hover:bg-slate-800"
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Save
                </>
              )}
            </Button>
            
            <Button
              onClick={handleCancel}
              disabled={isSaving}
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-slate-600 hover:text-slate-900"
            >
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {message}
          </p>
        </div>
      )}
    </div>
  );
}
