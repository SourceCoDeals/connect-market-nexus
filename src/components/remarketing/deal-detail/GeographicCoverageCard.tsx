import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Loader2, MapPin, X, Plus } from "lucide-react";
import { toast } from "sonner";

interface GeographicCoverageCardProps {
  states: string[] | null;
  onSave: (states: string[]) => Promise<void>;
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export const GeographicCoverageCard = ({ states, onSave }: GeographicCoverageCardProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedStates, setEditedStates] = useState<string[]>(states || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedStates);
      setIsEditOpen(false);
      toast.success("Geographic coverage updated");
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const addState = (state: string) => {
    if (!editedStates.includes(state)) {
      setEditedStates([...editedStates, state]);
    }
    setSearchQuery("");
  };

  const removeState = (state: string) => {
    setEditedStates(editedStates.filter(s => s !== state));
  };

  const openEdit = () => {
    setEditedStates(states || []);
    setIsEditOpen(true);
  };

  const filteredStates = US_STATES.filter(
    s => s.toLowerCase().includes(searchQuery.toLowerCase()) && !editedStates.includes(s)
  );

  return (
    <>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Geographic Coverage
            </CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={openEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {states && states.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {states.map(state => (
                <Badge key={state} variant="secondary" className="text-sm">
                  {state}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No states specified
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Geographic Coverage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Selected States</Label>
              <div className="flex flex-wrap gap-2 mt-2 min-h-[40px] p-2 border rounded-md bg-muted/30">
                {editedStates.length > 0 ? (
                  editedStates.map(state => (
                    <Badge key={state} variant="secondary" className="gap-1">
                      {state}
                      <button 
                        onClick={() => removeState(state)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No states selected</span>
                )}
              </div>
            </div>
            <div>
              <Label>Add States</Label>
              <Input
                placeholder="Search states..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-1.5"
              />
              {searchQuery && (
                <div className="flex flex-wrap gap-1 mt-2 max-h-[120px] overflow-auto">
                  {filteredStates.map(state => (
                    <Button
                      key={state}
                      variant="outline"
                      size="sm"
                      onClick={() => addState(state)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {state}
                    </Button>
                  ))}
                </div>
              )}
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
    </>
  );
};

export default GeographicCoverageCard;
