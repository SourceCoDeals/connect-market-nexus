import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";
import { ContactCSVImport } from "../ContactCSVImport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AddBuyerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackerId: string;
  onBuyerAdded: () => void;
}

export function AddBuyerDialog({ open, onOpenChange, trackerId, onBuyerAdded }: AddBuyerDialogProps) {
  const [peFirmName, setPeFirmName] = useState("");
  const [peFirmWebsite, setPeFirmWebsite] = useState("");
  const [platformName, setPlatformName] = useState("");
  const [platformWebsite, setPlatformWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!peFirmName.trim()) {
      toast({
        title: "PE Firm name required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("remarketing_buyers")
        .insert({
          universe_id: trackerId !== 'new' ? trackerId : null,
          company_name: peFirmName.trim(),
          company_website: peFirmWebsite.trim() || null,
          pe_firm_name: peFirmName.trim(),
          pe_firm_website: peFirmWebsite.trim() || null,
          platform_company_name: platformName.trim() || null,
          platform_website: platformWebsite.trim() || null,
          business_summary: notes.trim() || null,
        });

      if (error) throw error;

      toast({ title: "Buyer added successfully" });
      onBuyerAdded();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error adding buyer",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setPeFirmName("");
    setPeFirmWebsite("");
    setPlatformName("");
    setPlatformWebsite("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Buyer</DialogTitle>
          <DialogDescription>
            Add a new buyer manually or import from CSV
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="csv">
              <Upload className="w-4 h-4 mr-2" />
              CSV Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pe-firm-name">PE Firm Name *</Label>
                  <Input
                    id="pe-firm-name"
                    value={peFirmName}
                    onChange={(e) => setPeFirmName(e.target.value)}
                    placeholder="e.g., Vista Equity Partners"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pe-firm-website">PE Firm Website</Label>
                  <Input
                    id="pe-firm-website"
                    type="url"
                    value={peFirmWebsite}
                    onChange={(e) => setPeFirmWebsite(e.target.value)}
                    placeholder="https://vistaequitypartners.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platform-name">Platform Company Name</Label>
                  <Input
                    id="platform-name"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    placeholder="e.g., Pluralsight"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platform-website">Platform Website</Label>
                  <Input
                    id="platform-website"
                    type="url"
                    value={platformWebsite}
                    onChange={(e) => setPlatformWebsite(e.target.value)}
                    placeholder="https://pluralsight.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes about this buyer..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Buyer
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="csv" className="mt-4">
            <ContactCSVImport
              trackerId={trackerId}
              onImportComplete={() => {
                onBuyerAdded();
                onOpenChange(false);
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
