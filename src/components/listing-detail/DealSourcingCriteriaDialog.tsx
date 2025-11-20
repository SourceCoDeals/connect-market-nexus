import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Sparkles, CheckCircle2 } from "lucide-react";
import { User as AppUser } from "@/types";
import { Link } from "react-router-dom";

interface DealSourcingCriteriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AppUser | null;
}

type DialogState = 'form' | 'calendar' | 'success';

export const DealSourcingCriteriaDialog = ({ open, onOpenChange, user }: DealSourcingCriteriaDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>('form');
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");

  const handleGetMyDeals = async () => {
    if (!user) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("deal_sourcing_requests").insert([{
        user_id: user.id,
        buyer_type: user.buyer_type,
        business_categories: user.business_categories as string[] || null,
        target_locations: Array.isArray(user.target_locations) ? user.target_locations : (user.target_locations ? [user.target_locations] : null),
        revenue_min: user.revenue_range_min || null,
        revenue_max: user.revenue_range_max || null,
        investment_thesis: user.ideal_target_description || null,
        additional_notes: customMessage || null,
        custom_message: customMessage || null,
      }]);

      if (error) throw error;

      setDialogState('calendar');
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

  const handleClose = () => {
    setDialogState('form');
    setCustomMessage("");
    setIsCollapsibleOpen(false);
    onOpenChange(false);
  };

  const renderCriticalFields = () => (
    <div className="space-y-5 pb-6 border-b border-border/10">
      {/* Buyer Type */}
      {user?.buyer_type && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">
            Buyer Type
          </div>
          <Badge variant="secondary" className="text-[13px] font-medium px-3 py-1 bg-background border-border/30">
            {user.buyer_type}
          </Badge>
        </div>
      )}

      {/* Target Industries */}
      {user?.business_categories && Array.isArray(user.business_categories) && user.business_categories.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">
            Target Industries
          </div>
          <div className="flex flex-wrap gap-2">
            {user.business_categories.map((category, idx) => (
              <Badge key={idx} variant="outline" className="text-[12px] font-normal px-2.5 py-1 bg-background border-border/30">
                {category}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Geographic Focus */}
      {user?.target_locations && Array.isArray(user.target_locations) && user.target_locations.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">
            Geographic Focus
          </div>
          <div className="text-[15px] font-normal text-foreground">
            {user.target_locations.join(', ')}
          </div>
        </div>
      )}

      {/* Revenue Target */}
      {(user?.revenue_range_min || user?.revenue_range_max) && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">
            Revenue Target
          </div>
          <div className="text-[15px] font-normal text-foreground tabular-nums">
            {user.revenue_range_min && user.revenue_range_max
              ? `$${parseInt(user.revenue_range_min).toLocaleString()} - $${parseInt(user.revenue_range_max).toLocaleString()}`
              : user.revenue_range_min
              ? `$${parseInt(user.revenue_range_min).toLocaleString()}+`
              : user.revenue_range_max
              ? `Up to $${parseInt(user.revenue_range_max).toLocaleString()}`
              : "Not specified"}
          </div>
        </div>
      )}

      {/* Investment Thesis */}
      {user?.ideal_target_description && (
        <div className="space-y-3 pt-2">
          <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">
            Investment Thesis
          </div>
          <div className="text-[15px] font-normal text-foreground/90 leading-[1.6]">
            {user.ideal_target_description}
          </div>
        </div>
      )}
    </div>
  );

  const renderAdditionalFields = () => {
    return null;
  };

  const renderFormView = () => (
    <DialogContent className="max-w-[580px] px-0 pb-0">
      {/* Fixed Header */}
      <div className="px-8 pt-6 pb-4">
        <DialogHeader>
          <DialogTitle className="text-[28px] font-[300] tracking-tight text-foreground leading-[34px] mb-2">
            Get Your Custom Deal Flow
          </DialogTitle>
          <DialogDescription className="text-[15px] font-normal text-foreground/60 leading-relaxed max-w-[520px]">
            Review your investment criteria below and we'll schedule a call to discuss tailored opportunities
          </DialogDescription>
        </DialogHeader>
      </div>

      {/* Scrollable Content Area */}
      <ScrollArea className="max-h-[calc(85vh-180px)] px-8">
        <div className="space-y-6 pb-6">
          {/* Critical Profile Fields */}
          {renderCriticalFields()}

          {/* Collapsible Additional Profile */}
          {renderAdditionalFields() && (
            <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between py-3 px-4 -mx-4 rounded-lg hover:bg-muted/40 transition-all duration-150 ease-out group">
                  <span className="text-[13px] font-medium text-foreground/70 group-hover:text-foreground transition-colors">
                    View complete profile
                  </span>
                  {isCollapsibleOpen ? (
                    <ChevronUp className="h-4 w-4 text-foreground/50 group-hover:text-foreground transition-colors" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-foreground/50 group-hover:text-foreground transition-colors" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                {renderAdditionalFields()}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Edit Profile Link */}
          <div className="pt-2 pb-4 border-b border-border/10">
            <p className="text-[12px] text-foreground/50 text-center">
              Need to update your profile?{" "}
              <Link to="/profile" className="text-foreground/70 hover:text-foreground underline underline-offset-2 font-medium transition-colors">
                Edit your criteria
              </Link>
            </p>
          </div>

          {/* Custom Message Field */}
          <div className="space-y-3 pt-2">
            <label htmlFor="customMessage" className="text-[13px] font-medium text-foreground/80 block">
              Additional Context <span className="text-foreground/40 font-normal">(Optional)</span>
            </label>
            <Textarea
              id="customMessage"
              placeholder="Tell us more about what you're looking for, deal structures you prefer, or any specific requirements..."
              rows={4}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="resize-none border-border/30 bg-background focus:bg-background focus:border-border text-[14px] leading-relaxed min-h-[100px] transition-all duration-150"
            />
            <p className="text-[11px] text-foreground/40 leading-relaxed">
              Share specific deal structures, timing requirements, or other preferences to help us source better matches
            </p>
          </div>
        </div>
      </ScrollArea>

      {/* Fixed Footer with CTA */}
      <div className="px-8 py-5 border-t border-border/20 bg-background/80 backdrop-blur-sm">
        <Button
          onClick={handleGetMyDeals}
          disabled={isSubmitting}
          className="w-full h-12 bg-[#D8B75D] hover:bg-[#C5A54A] text-slate-900 font-semibold text-[14px] tracking-wide shadow-sm hover:shadow-md transition-all duration-200"
        >
          {isSubmitting ? "Submitting..." : "Get My Deals"}
          <Sparkles className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </DialogContent>
  );

  const renderCalendarView = () => (
    <DialogContent className="max-w-[580px] px-8 py-6">
      <DialogHeader>
        <DialogTitle className="text-[28px] font-[300] tracking-tight text-foreground leading-[34px] mb-2">
          Schedule Your Discovery Call
        </DialogTitle>
        <DialogDescription className="text-[15px] font-normal text-foreground/60 leading-relaxed">
          Book a time that works for you to discuss your custom deal flow
        </DialogDescription>
      </DialogHeader>

      <div className="my-6 rounded-lg overflow-hidden border border-border/20">
        <iframe
          src="https://calendly.com/your-calendly-link"
          width="100%"
          height="650"
          frameBorder="0"
          className="bg-background"
        />
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-border/10">
        <button
          onClick={() => setDialogState('success')}
          className="text-[13px] text-foreground/50 hover:text-foreground/80 transition-colors underline underline-offset-2"
        >
          Skip for now
        </button>
        <Button
          onClick={() => setDialogState('success')}
          className="bg-[#D8B75D] hover:bg-[#C5A54A] text-slate-900 font-semibold text-[14px] px-6"
        >
          Done
        </Button>
      </div>
    </DialogContent>
  );

  const renderSuccessView = () => (
    <DialogContent className="max-w-[480px] px-8 py-8">
      <div className="flex flex-col items-center text-center space-y-6">
        <div className="rounded-full bg-green-50 p-4">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        
        <div className="space-y-3">
          <DialogTitle className="text-[28px] font-[300] tracking-tight text-foreground leading-[34px]">
            We'll Be In Touch Soon
          </DialogTitle>
          <DialogDescription className="text-[15px] font-normal text-foreground/60 leading-[1.65] max-w-[400px]">
            Our team will review your criteria and reach out with tailored opportunities that match your investment thesis.
          </DialogDescription>
        </div>

        <Button
          onClick={handleClose}
          className="w-full h-11 bg-[#D8B75D] hover:bg-[#C5A54A] text-slate-900 font-semibold text-[14px] tracking-wide transition-all duration-200"
        >
          Close
        </Button>
      </div>
    </DialogContent>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {dialogState === 'form' && renderFormView()}
      {dialogState === 'calendar' && renderCalendarView()}
      {dialogState === 'success' && renderSuccessView()}
    </Dialog>
  );
};
