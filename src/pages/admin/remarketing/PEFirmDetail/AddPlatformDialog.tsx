import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddPlatformDialogProps {
  firmName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newPlatform: {
    company_name: string;
    company_website: string;
    universe_id: string;
    thesis_summary: string;
  };
  setNewPlatform: (platform: {
    company_name: string;
    company_website: string;
    universe_id: string;
    thesis_summary: string;
  }) => void;
  universes: Array<{ id: string; name: string }> | undefined;
  onSubmit: () => void;
  isPending: boolean;
}

export const AddPlatformDialog = ({
  firmName,
  open,
  onOpenChange,
  newPlatform,
  setNewPlatform,
  universes,
  onSubmit,
  isPending,
}: AddPlatformDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Platform Company</DialogTitle>
          <DialogDescription>
            Add a new platform company under {firmName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="platform_name">Company Name *</Label>
            <Input
              id="platform_name"
              placeholder="e.g., Airo Mechanical"
              value={newPlatform.company_name}
              onChange={(e) =>
                setNewPlatform({ ...newPlatform, company_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform_website">Website</Label>
            <Input
              id="platform_website"
              placeholder="https://example.com"
              value={newPlatform.company_website}
              onChange={(e) =>
                setNewPlatform({ ...newPlatform, company_website: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform_universe">Buyer Universe</Label>
            <select
              id="platform_universe"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={newPlatform.universe_id}
              onChange={(e) =>
                setNewPlatform({ ...newPlatform, universe_id: e.target.value })
              }
            >
              <option value="">No universe</option>
              {universes?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform_thesis">Investment Thesis</Label>
            <Textarea
              id="platform_thesis"
              placeholder="Brief description of this platform's acquisition focus..."
              value={newPlatform.thesis_summary}
              onChange={(e) =>
                setNewPlatform({ ...newPlatform, thesis_summary: e.target.value })
              }
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              !newPlatform.company_name.trim() || isPending
            }
          >
            {isPending ? "Adding..." : "Add Platform"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
