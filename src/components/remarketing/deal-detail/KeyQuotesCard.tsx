import { useState } from "react";
import { Quote, ChevronDown, Pencil, Plus, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface KeyQuotesCardProps {
  quotes?: string[] | null;
  onSave?: (quotes: string[]) => Promise<void>;
}

export const KeyQuotesCard = ({
  quotes,
  onSave,
}: KeyQuotesCardProps) => {
  const [showAll, setShowAll] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedQuotes, setEditedQuotes] = useState<string[]>([]);
  const [newQuote, setNewQuote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const openEdit = () => {
    setEditedQuotes(quotes || []);
    setNewQuote("");
    setIsEditOpen(true);
  };

  const handleAddQuote = () => {
    if (newQuote.trim()) {
      setEditedQuotes([...editedQuotes, newQuote.trim()]);
      setNewQuote("");
    }
  };

  const handleRemoveQuote = (index: number) => {
    setEditedQuotes(editedQuotes.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(editedQuotes);
      setIsEditOpen(false);
      toast.success("Quotes updated");
    } catch (error) {
      toast.error("Failed to save quotes");
    } finally {
      setIsSaving(false);
    }
  };

  const displayQuotes = showAll ? (quotes || []) : (quotes || []).slice(0, 3);
  const remainingCount = (quotes?.length || 0) - 3;

  // Show add button even when empty
  if (!quotes || quotes.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Quote className="h-4 w-4" />
              Key Quotes
            </CardTitle>
            {onSave && (
              <Button variant="ghost" size="sm" onClick={openEdit}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            No key quotes captured yet. Add quotes from transcripts or manually.
          </p>
        </CardContent>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Key Quotes</DialogTitle>
              <DialogDescription>
                Add verbatim quotes from the seller that reveal important information about their goals, concerns, or business.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {editedQuotes.map((quote, index) => (
                <div 
                  key={index}
                  className="relative pl-4 pr-8 border-l-4 border-amber-400 py-2 bg-muted/30 rounded-r"
                >
                  <p className="text-sm italic">"{quote}"</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-6 w-6"
                    onClick={() => handleRemoveQuote(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              <div className="space-y-2">
                <Textarea
                  placeholder="Enter a verbatim quote from the seller..."
                  value={newQuote}
                  onChange={(e) => setNewQuote(e.target.value)}
                  className="min-h-[80px]"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddQuote}
                  disabled={!newQuote.trim()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Quote
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Quote className="h-4 w-4" />
            Key Quotes ({quotes.length})
          </CardTitle>
          {onSave && (
            <Button variant="ghost" size="sm" onClick={openEdit}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayQuotes.map((quote, index) => (
          <div 
            key={index}
            className="pl-4 border-l-4 border-amber-400 py-1"
          >
            <p className="text-sm text-muted-foreground italic">"{quote}"</p>
          </div>
        ))}
        
        {remainingCount > 0 && !showAll && (
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground"
            onClick={() => setShowAll(true)}
          >
            Show {remainingCount} more quotes
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        )}
        
        {showAll && quotes.length > 3 && (
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground"
            onClick={() => setShowAll(false)}
          >
            Show less
          </Button>
        )}
      </CardContent>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Key Quotes</DialogTitle>
            <DialogDescription>
              Add verbatim quotes from the seller that reveal important information about their goals, concerns, or business.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {editedQuotes.map((quote, index) => (
              <div 
                key={index}
                className="relative pl-4 pr-8 border-l-4 border-amber-400 py-2 bg-muted/30 rounded-r"
              >
                <p className="text-sm italic">"{quote}"</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6"
                  onClick={() => handleRemoveQuote(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}

            <div className="space-y-2">
              <Textarea
                placeholder="Enter a verbatim quote from the seller..."
                value={newQuote}
                onChange={(e) => setNewQuote(e.target.value)}
                className="min-h-[80px]"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAddQuote}
                disabled={!newQuote.trim()}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Quote
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default KeyQuotesCard;
