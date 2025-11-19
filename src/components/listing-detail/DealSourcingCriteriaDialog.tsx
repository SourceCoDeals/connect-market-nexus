import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ExternalLink } from "lucide-react";
import { User as AppUser } from "@/types";

interface DealSourcingCriteriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AppUser | null;
}

export const DealSourcingCriteriaDialog = ({ open, onOpenChange, user }: DealSourcingCriteriaDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    businessCategories: Array.isArray(user?.business_categories) 
      ? user.business_categories.join(", ") 
      : user?.business_categories || "",
    targetLocations: Array.isArray(user?.target_locations)
      ? user.target_locations.join(", ")
      : user?.target_locations || "",
    revenueMin: user?.revenue_range_min || "",
    revenueMax: user?.revenue_range_max || "",
    investmentThesis: user?.ideal_target_description || "",
    additionalNotes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("deal_sourcing_requests").insert({
        user_id: user.id,
        buyer_type: user.buyer_type,
        business_categories: formData.businessCategories.split(",").map(s => s.trim()).filter(Boolean),
        target_locations: formData.targetLocations.split(",").map(s => s.trim()).filter(Boolean),
        revenue_min: formData.revenueMin,
        revenue_max: formData.revenueMax,
        investment_thesis: formData.investmentThesis,
        additional_notes: formData.additionalNotes,
      });

      if (error) throw error;

      toast({
        title: "Request Submitted",
        description: "We'll start sourcing exclusive opportunities tailored to your criteria and be in touch soon.",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting deal sourcing request:", error);
      toast({
        title: "Error",
        description: "Failed to submit your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleCall = () => {
    window.open("https://tidycal.com/tomosmughan/30-minute-meeting", "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white border-slate-200/60 shadow-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Get Bespoke Deal Flow</DialogTitle>
          <DialogDescription className="text-slate-600">
            Share your investment criteria and we'll source off-market opportunities tailored to your thesis
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Buyer Type</Label>
            <div>
              <Badge variant="secondary" className="text-sm">
                {user?.buyer_type || "Not specified"}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessCategories" className="text-sm font-medium">
              Target Industries *
            </Label>
            <Input
              id="businessCategories"
              value={formData.businessCategories}
              onChange={(e) => setFormData({ ...formData, businessCategories: e.target.value })}
              placeholder="SaaS, Manufacturing, Healthcare..."
              required
              className="border-slate-200/60"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetLocations" className="text-sm font-medium">
              Geographic Preferences *
            </Label>
            <Input
              id="targetLocations"
              value={formData.targetLocations}
              onChange={(e) => setFormData({ ...formData, targetLocations: e.target.value })}
              placeholder="Northeast, Texas, California..."
              required
              className="border-slate-200/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="revenueMin" className="text-sm font-medium">
                Min Revenue ($M) *
              </Label>
              <Input
                id="revenueMin"
                type="text"
                value={formData.revenueMin}
                onChange={(e) => setFormData({ ...formData, revenueMin: e.target.value })}
                placeholder="e.g., $1M"
                required
                className="border-slate-200/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revenueMax" className="text-sm font-medium">
                Max Revenue ($M)
              </Label>
              <Input
                id="revenueMax"
                type="text"
                value={formData.revenueMax}
                onChange={(e) => setFormData({ ...formData, revenueMax: e.target.value })}
                placeholder="e.g., $10M"
                className="border-slate-200/60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="investmentThesis" className="text-sm font-medium">
              Investment Thesis *
            </Label>
            <Textarea
              id="investmentThesis"
              value={formData.investmentThesis}
              onChange={(e) => setFormData({ ...formData, investmentThesis: e.target.value })}
              placeholder="Describe your ideal acquisition target..."
              required
              rows={4}
              className="border-slate-200/60 resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalNotes" className="text-sm font-medium">
              Additional Requirements (optional)
            </Label>
            <Textarea
              id="additionalNotes"
              value={formData.additionalNotes}
              onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
              placeholder="Any specific exclusions, deal structures, or preferences..."
              rows={3}
              className="border-slate-200/60 resize-none"
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleScheduleCall}
              className="w-full sm:w-auto gap-2"
            >
              <Calendar className="h-4 w-4" />
              Schedule a Call Instead
              <ExternalLink className="h-3 w-3" />
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-foreground text-background hover:bg-foreground/90"
            >
              {isSubmitting ? "Submitting..." : "Submit Criteria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
