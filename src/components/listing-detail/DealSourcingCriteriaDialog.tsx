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
  const [showAllIndustries, setShowAllIndustries] = useState(false);

  const INITIAL_INDUSTRIES_DISPLAY = 3;

  const formatBuyerType = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'privateEquity': 'Private Equity',
      'familyOffice': 'Family Office',
      'individualBuyer': 'Individual Buyer',
      'searchFund': 'Search Fund',
      'strategicBuyer': 'Strategic Buyer',
      'ventureCapital': 'Venture Capital',
    };
    return typeMap[type] || type;
  };

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

      toast({
        title: "Request submitted",
        description: "We'll be in touch with matching opportunities soon.",
      });

      setDialogState('success');
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
    onOpenChange(false);
    setDialogState('form');
    setCustomMessage("");
  };

  const renderFormView = () => (
    <DialogContent className="max-w-[680px] px-0 py-0 gap-0 overflow-hidden">
      <div className="px-8 pt-8 pb-6 border-b border-border/10">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#D8B75D]" />
            <DialogTitle className="text-[28px] font-[300] tracking-tight text-foreground leading-[34px]">
              Let Us Source Deals for You
            </DialogTitle>
          </div>
          <DialogDescription className="text-[15px] font-normal text-foreground/60 leading-[1.65]">
            Based on your profile, we'll curate exclusive off-market opportunities that align with your investment criteria.
          </DialogDescription>
        </DialogHeader>
      </div>

      <ScrollArea className="max-h-[calc(85vh-180px)]">
        <div className="px-8 py-6 space-y-6">
          <div className="pb-4 border-b border-border/10">
            <div className="flex items-center gap-2 text-[15px]">
              <span className="font-semibold text-foreground">{user?.company_name || 'Your Company'}</span>
              <span className="text-foreground/40">•</span>
              <span className="text-foreground/70">{formatBuyerType(user?.buyer_type || '')}</span>
              {user?.job_title && (<><span className="text-foreground/40">•</span><span className="text-foreground/70">{user.job_title}</span></>)}
            </div>
          </div>

          <div className="space-y-5">
            {user?.business_categories && Array.isArray(user.business_categories) && user.business_categories.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">Target Industries</div>
                <div className="flex flex-wrap gap-2">
                  {(showAllIndustries ? user.business_categories : user.business_categories.slice(0, INITIAL_INDUSTRIES_DISPLAY)).map((category, index) => (
                    <Badge key={index} variant="secondary" className="bg-secondary/50 text-foreground/80 hover:bg-secondary text-[13px] px-3 py-1 font-normal">{category}</Badge>
                  ))}
                  {user.business_categories.length > INITIAL_INDUSTRIES_DISPLAY && (
                    <button onClick={() => setShowAllIndustries(!showAllIndustries)} className="text-[13px] text-primary hover:text-primary/80 transition-colors font-medium flex items-center gap-1">
                      {showAllIndustries ? (<>Show less <ChevronUp className="h-3 w-3" /></>) : (<>+{user.business_categories.length - INITIAL_INDUSTRIES_DISPLAY} more <ChevronDown className="h-3 w-3" /></>)}
                    </button>
                  )}
                </div>
              </div>
            )}

            {user?.target_locations && Array.isArray(user.target_locations) && user.target_locations.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">Geographic Focus</div>
                <div className="text-[15px] font-normal text-foreground">{user.target_locations.join(', ')}</div>
              </div>
            )}

            {(user?.revenue_range_min || user?.revenue_range_max) && (
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">Revenue Target</div>
                <div className="text-[15px] font-normal text-foreground tabular-nums">
                  {user.revenue_range_min && user.revenue_range_max ? `$${parseInt(user.revenue_range_min).toLocaleString()} - $${parseInt(user.revenue_range_max).toLocaleString()}` : user.revenue_range_min ? `$${parseInt(user.revenue_range_min).toLocaleString()}+` : user.revenue_range_max ? `Up to $${parseInt(user.revenue_range_max).toLocaleString()}` : "Not specified"}
                </div>
              </div>
            )}

            {user?.ideal_target_description && (
              <div className="space-y-3 pt-2">
                <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">Investment Thesis</div>
                <div className="text-[15px] font-normal text-foreground/80 leading-[1.65] whitespace-pre-wrap">{user.ideal_target_description}</div>
              </div>
            )}
          </div>

          <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen}>
            <CollapsibleTrigger className="w-full h-11 rounded-md flex items-center justify-between text-[15px] font-medium text-foreground hover:bg-secondary/50 transition-colors px-3 -mx-3">
              Additional Details
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isCollapsibleOpen ? '-rotate-180' : 'rotate-0'}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-4">
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">EBITDA</div>
                <div className="text-[15px] font-normal text-foreground tabular-nums">Not specified</div>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">Valuation Range</div>
                <div className="text-[15px] font-normal text-foreground tabular-nums">Not specified</div>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">Minimum Equity Check Size</div>
                <div className="text-[15px] font-normal text-foreground tabular-nums">Not specified</div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-3 pt-2">
            <div className="text-[13px] font-medium text-foreground/80">Additional Notes (Optional)</div>
            <Textarea placeholder="Any specific requirements or questions for our deal sourcing team..." value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} className="min-h-[100px] text-[14px] resize-none" />
          </div>

          <div className="pt-4 border-t border-border/10">
            <p className="text-xs text-foreground/50 text-center">
              Need to update your profile? <Link to="/profile" className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors" onClick={() => onOpenChange(false)}>Edit your criteria</Link>
            </p>
          </div>
        </div>
      </ScrollArea>

      <div className="px-8 py-6 border-t border-border/10 bg-muted/30">
        <Button onClick={handleGetMyDeals} disabled={isSubmitting} className="w-full h-11 bg-[#D8B75D] hover:bg-[#C5A54A] text-slate-900 font-semibold text-[14px] tracking-wide transition-all duration-200">
          {isSubmitting ? "Submitting..." : "Get My Deals"}
        </Button>
      </div>
    </DialogContent>
  );

  const renderSuccessView = () => (
    <DialogContent className="max-w-[480px] px-8 py-8">
      <div className="flex flex-col items-center text-center space-y-6">
        <div className="rounded-full bg-green-50 p-4"><CheckCircle2 className="h-12 w-12 text-green-600" /></div>
        <div className="space-y-3">
          <DialogTitle className="text-[28px] font-[300] tracking-tight text-foreground leading-[34px]">We'll Be In Touch Soon</DialogTitle>
          <DialogDescription className="text-[15px] font-normal text-foreground/60 leading-[1.65] max-w-[400px]">Our team will review your criteria and reach out with tailored opportunities. You'll receive a calendar link to schedule your discovery call.</DialogDescription>
        </div>
        <Button onClick={handleClose} className="w-full h-11 bg-[#D8B75D] hover:bg-[#C5A54A] text-slate-900 font-semibold text-[14px] tracking-wide transition-all duration-200">Close</Button>
      </div>
    </DialogContent>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {dialogState === 'form' && renderFormView()}
      {dialogState === 'success' && renderSuccessView()}
    </Dialog>
  );
};
