import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

      // Transition to calendar state
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
    <div className="space-y-3">
      {/* Buyer Type */}
      <div className="bg-slate-50/30 rounded-lg p-3 border border-slate-100">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
          Buyer Type
        </div>
        <Badge variant="secondary" className="text-sm font-medium">
          {user?.buyer_type || "Not specified"}
        </Badge>
      </div>

      {/* Target Industries */}
      {user?.business_categories && Array.isArray(user.business_categories) && user.business_categories.length > 0 && (
        <div className="bg-slate-50/30 rounded-lg p-3 border border-slate-100">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
            Target Industries
          </div>
          <div className="flex flex-wrap gap-1.5">
            {user.business_categories.map((category, idx) => (
              <Badge key={idx} variant="outline" className="text-xs bg-white">
                {category}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Geographic Focus */}
      {user?.target_locations && Array.isArray(user.target_locations) && user.target_locations.length > 0 && (
        <div className="bg-slate-50/30 rounded-lg p-3 border border-slate-100">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
            Geographic Focus
          </div>
          <div className="flex flex-wrap gap-1.5">
            {user.target_locations.map((location, idx) => (
              <Badge key={idx} variant="outline" className="text-xs bg-white">
                {location}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Target */}
      {(user?.revenue_range_min || user?.revenue_range_max) && (
        <div className="bg-slate-50/30 rounded-lg p-3 border border-slate-100">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
            Revenue Target
          </div>
          <div className="text-sm text-slate-900 font-medium">
            {user.revenue_range_min && user.revenue_range_max
              ? `${user.revenue_range_min} - ${user.revenue_range_max}`
              : user.revenue_range_min
              ? `${user.revenue_range_min}+`
              : user.revenue_range_max
              ? `Up to ${user.revenue_range_max}`
              : "Not specified"}
          </div>
        </div>
      )}

      {/* Investment Thesis */}
      {user?.ideal_target_description && (
        <div className="bg-slate-50/30 rounded-lg p-3 border border-slate-100">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
            Investment Thesis
          </div>
          <div className="text-sm text-slate-900 leading-relaxed">
            {user.ideal_target_description}
          </div>
        </div>
      )}
    </div>
  );

  const renderAdditionalFields = () => {
    const fields: { label: string; value: any }[] = [];

    // Deal Intent
    if (user?.deal_intent) {
      fields.push({ label: "Deal Intent", value: user.deal_intent });
    }

    // Exclusions
    if (user?.exclusions && user.exclusions.length > 0) {
      fields.push({ label: "Exclusions", value: user.exclusions });
    }

    // Include Keywords
    if (user?.include_keywords && user.include_keywords.length > 0) {
      fields.push({ label: "Include Keywords", value: user.include_keywords });
    }

    // LinkedIn Profile
    if (user?.linkedin_profile) {
      fields.push({ label: "LinkedIn", value: user.linkedin_profile });
    }

    // Company Name
    if (user?.company_name) {
      fields.push({ label: "Company", value: user.company_name });
    }

    // Job Title
    if (user?.job_title) {
      fields.push({ label: "Job Title", value: user.job_title });
    }

    // Buyer-type-specific fields
    switch (user?.buyer_type) {
      case "privateEquity":
        if (user?.deploying_capital_now) {
          fields.push({ label: "Deploying Capital Now", value: user.deploying_capital_now });
        }
        if (user?.portfolio_company_addon) {
          fields.push({ label: "Portfolio Company Add-on", value: user.portfolio_company_addon });
        }
        if (user?.fund_size) {
          fields.push({ label: "Fund Size", value: user.fund_size });
        }
        if (user?.aum) {
          fields.push({ label: "AUM", value: user.aum });
        }
        break;

      case "corporate":
        if (user?.integration_plan) {
          fields.push({ label: "Integration Plan", value: user.integration_plan });
        }
        if (user?.deal_size_band) {
          fields.push({ label: "Deal Size Band", value: user.deal_size_band });
        }
        if (user?.owning_business_unit) {
          fields.push({ label: "Owning Business Unit", value: user.owning_business_unit });
        }
        if (user?.corpdev_intent) {
          fields.push({ label: "CorpDev Intent", value: user.corpdev_intent });
        }
        break;

      case "familyOffice":
        if (user?.discretion_type) {
          fields.push({ label: "Discretion Type", value: user.discretion_type });
        }
        if (user?.permanent_capital !== undefined) {
          fields.push({ label: "Permanent Capital", value: user.permanent_capital ? "Yes" : "No" });
        }
        if (user?.operating_company_targets) {
          fields.push({ label: "Operating Company Targets", value: user.operating_company_targets });
        }
        break;

      case "independentSponsor":
        if (user?.committed_equity_band) {
          fields.push({ label: "Committed Equity Band", value: user.committed_equity_band });
        }
        if (user?.equity_source) {
          fields.push({ label: "Equity Source", value: user.equity_source });
        }
        if (user?.deployment_timing) {
          fields.push({ label: "Deployment Timing", value: user.deployment_timing });
        }
        if (user?.backers_summary) {
          fields.push({ label: "Backers Summary", value: user.backers_summary });
        }
        break;

      case "searchFund":
        if (user?.search_type) {
          fields.push({ label: "Search Type", value: user.search_type });
        }
        if (user?.acq_equity_band) {
          fields.push({ label: "Acquisition Equity Band", value: user.acq_equity_band });
        }
        if (user?.financing_plan) {
          fields.push({ label: "Financing Plan", value: user.financing_plan });
        }
        if (user?.search_stage) {
          fields.push({ label: "Search Stage", value: user.search_stage });
        }
        if (user?.anchor_investors_summary) {
          fields.push({ label: "Anchor Investors", value: user.anchor_investors_summary });
        }
        break;

      case "individual":
        if (user?.max_equity_today_band) {
          fields.push({ label: "Max Equity Today", value: user.max_equity_today_band });
        }
        if (user?.uses_bank_finance) {
          fields.push({ label: "Uses Bank Finance", value: user.uses_bank_finance });
        }
        if (user?.funding_source) {
          fields.push({ label: "Funding Source", value: user.funding_source });
        }
        break;
    }

    if (fields.length === 0) return null;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((field, idx) => (
          <div key={idx} className="bg-slate-50/30 rounded-lg p-3 border border-slate-100">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              {field.label}
            </div>
            <div className="text-sm text-slate-900">
              {Array.isArray(field.value) ? (
                <div className="flex flex-wrap gap-1.5">
                  {field.value.map((item, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-white">
                      {item}
                    </Badge>
                  ))}
                </div>
              ) : (
                field.value
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFormView = () => (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-semibold text-slate-900">
          Get Your Custom Deal Flow
        </DialogTitle>
        <DialogDescription className="text-sm text-slate-600 leading-relaxed">
          Review your investment criteria below and we'll schedule a call to discuss tailored opportunities
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Critical Profile Fields */}
        {renderCriticalFields()}

        {/* Collapsible Additional Profile */}
        {renderAdditionalFields() && (
          <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-slate-600 hover:text-slate-900">
                <span className="text-sm">View complete profile</span>
                {isCollapsibleOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              {renderAdditionalFields()}
            </CollapsibleContent>
          </Collapsible>
        )}

        <p className="text-xs text-slate-500 text-center">
          Need to update your profile?{" "}
          <Link to="/profile" className="text-slate-700 hover:text-slate-900 underline">
            Edit your criteria
          </Link>
        </p>

        {/* Custom Message Field */}
        <div className="space-y-2 pt-4 border-t border-slate-200/60">
          <label htmlFor="customMessage" className="text-sm font-medium text-slate-700 block">
            Additional Context (Optional)
          </label>
          <Textarea
            id="customMessage"
            placeholder="Tell us more about what you're looking for, deal structures you prefer, or any specific requirements..."
            rows={3}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="resize-none border-slate-200/60 bg-slate-50/30 focus:bg-white transition-colors text-sm"
          />
        </div>

        {/* Primary CTA */}
        <Button
          onClick={handleGetMyDeals}
          disabled={isSubmitting}
          className="w-full h-12 bg-[#D8B75D] hover:bg-[#C5A54A] text-slate-900 font-semibold text-sm tracking-wide shadow-md hover:shadow-lg transition-all duration-200"
        >
          {isSubmitting ? "Submitting..." : "Get My Deals"}
          <Sparkles className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </>
  );

  const renderCalendarView = () => (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-semibold text-slate-900">
          Schedule Your Discovery Call
        </DialogTitle>
        <DialogDescription className="text-sm text-slate-600 leading-relaxed">
          Choose a time that works best for you to discuss your investment criteria and deal flow
        </DialogDescription>
      </DialogHeader>

      <div className="py-4 space-y-4">
        <div className="w-full h-[600px] rounded-lg overflow-hidden border border-slate-200/60 bg-white">
          <iframe
            src="https://tidycal.com/tomosmughan/30-minute-meeting"
            width="100%"
            height="100%"
            frameBorder="0"
            className="bg-white"
            title="Schedule a meeting"
          />
        </div>

        <div className="text-center">
          <button
            onClick={() => setDialogState('success')}
            className="text-sm text-slate-600 hover:text-slate-900 underline"
          >
            Skip for now
          </button>
        </div>
      </div>
    </>
  );

  const renderSuccessView = () => (
    <div className="py-8 text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-2xl font-semibold text-slate-900">You're All Set!</h3>
        <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
          We'll review your criteria and start sourcing exclusive opportunities. If you scheduled a call, we'll speak soon. 
          Otherwise, we'll reach out within 48 hours.
        </p>
      </div>

      <Button
        onClick={handleClose}
        className="bg-[#D8B75D] hover:bg-[#C5A54A] text-slate-900 font-semibold px-8"
      >
        Return to Listing
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl bg-white border border-slate-200/60 shadow-lg rounded-xl">
        {dialogState === 'form' && renderFormView()}
        {dialogState === 'calendar' && renderCalendarView()}
        {dialogState === 'success' && renderSuccessView()}
      </DialogContent>
    </Dialog>
  );
};
