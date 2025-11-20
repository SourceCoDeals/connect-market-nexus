import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Sparkles, CheckCircle2, Pencil, Check, X } from "lucide-react";
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
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

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

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleFieldEdit = async (field: string) => {
    if (!user || !editValue.trim()) {
      cancelEditing();
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: editValue.trim() })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Updated",
        description: "Your profile has been updated successfully.",
      });

      // Refresh the user data
      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      cancelEditing();
    }
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

  const renderCriticalFields = () => {
    const industries = user?.business_categories && Array.isArray(user.business_categories) ? user.business_categories : [];
    const displayedIndustries = showAllIndustries ? industries : industries.slice(0, INITIAL_INDUSTRIES_DISPLAY);
    const hasMoreIndustries = industries.length > INITIAL_INDUSTRIES_DISPLAY;

    return (
      <div className="space-y-5 pb-6 border-b border-border/10">
        {/* Sophisticated Buyer Identity Header */}
        {user && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">
              Buyer Type
            </div>
            <div className="text-[15px] font-medium text-foreground leading-relaxed">
              {user.company_name && <span className="font-semibold">{user.company_name}</span>}
              {user.company_name && user.buyer_type && <span className="text-foreground/40 mx-2">•</span>}
              {user.buyer_type && <span>{formatBuyerType(user.buyer_type)}</span>}
              {user.job_title && (
                <>
                  <span className="text-foreground/40 mx-2">•</span>
                  <span className="text-foreground/70">{user.job_title}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Target Industries with Show More/Less */}
        {industries.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">
              Target Industries
            </div>
            <div className="flex flex-wrap gap-2">
              {displayedIndustries.map((category, idx) => (
                <Badge key={idx} variant="outline" className="text-[12px] font-normal px-2.5 py-1 bg-background border-border/30">
                  {category}
                </Badge>
              ))}
            </div>
            {hasMoreIndustries && (
              <button
                onClick={() => setShowAllIndustries(!showAllIndustries)}
                className="text-[12px] text-foreground/60 hover:text-foreground font-medium transition-colors underline underline-offset-2"
              >
                {showAllIndustries ? `Show less` : `Show ${industries.length - INITIAL_INDUSTRIES_DISPLAY} more`}
              </button>
            )}
          </div>
        )}

        {/* Geographic Focus with Inline Edit */}
        {user?.target_locations && Array.isArray(user.target_locations) && user.target_locations.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">
                Geographic Focus
              </div>
              {editingField !== 'target_locations' && (
                <button
                  onClick={() => {
                    const locations = Array.isArray(user.target_locations) 
                      ? user.target_locations.join(', ') 
                      : user.target_locations || '';
                    startEditing('target_locations', locations);
                  }}
                  className="text-foreground/40 hover:text-foreground transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
            {editingField === 'target_locations' ? (
              <div className="flex gap-2 items-center">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="text-[14px]"
                  placeholder="Separate locations with commas"
                />
                <Button
                  size="sm"
                  onClick={() => handleFieldEdit('target_locations')}
                  className="h-8 w-8 p-0"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={cancelEditing}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="text-[15px] font-normal text-foreground">
                {Array.isArray(user.target_locations) ? user.target_locations.join(', ') : user.target_locations}
              </div>
            )}
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

        {/* Investment Thesis with Inline Edit */}
        {user?.ideal_target_description && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">
                Investment Thesis
              </div>
              {editingField !== 'ideal_target_description' && (
                <button
                  onClick={() => startEditing('ideal_target_description', user.ideal_target_description || '')}
                  className="text-foreground/40 hover:text-foreground transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
            {editingField === 'ideal_target_description' ? (
              <div className="flex flex-col gap-2">
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="text-[14px] min-h-[100px]"
                  placeholder="Describe your investment thesis..."
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleFieldEdit('ideal_target_description')}
                  >
                    <Check className="h-4 w-4 mr-1" /> Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelEditing}
                  >
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-[15px] font-normal text-foreground/90 leading-[1.6]">
                {user.ideal_target_description}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAdditionalFields = () => {
    if (!user) return null;

    const fields: Array<{ label: string; value: any; key?: string }> = [];

    // Deal Structure & Preferences
    if (user.deal_structure_preference) {
      fields.push({
        label: 'Deal Structure Preference',
        value: user.deal_structure_preference,
        key: 'deal_structure_preference'
      });
    }

    if (user.investment_size) {
      const size = Array.isArray(user.investment_size) 
        ? user.investment_size.join(', ')
        : user.investment_size;
      fields.push({
        label: 'Investment Size',
        value: size.includes('$') ? size : `$${size}`,
      });
    }

    if (user.target_deal_size_min || user.target_deal_size_max) {
      const min = user.target_deal_size_min ? `$${user.target_deal_size_min.toLocaleString()}` : '';
      const max = user.target_deal_size_max ? `$${user.target_deal_size_max.toLocaleString()}` : '';
      fields.push({
        label: 'Target Deal Size',
        value: min && max ? `${min} - ${max}` : min || max,
      });
    }

    // Financial Profile
    if (user.fund_size) {
      fields.push({
        label: 'Fund Size',
        value: `$${parseInt(user.fund_size).toLocaleString()}`,
      });
    }

    if (user.aum) {
      fields.push({
        label: 'Assets Under Management',
        value: `$${parseInt(user.aum).toLocaleString()}`,
      });
    }

    // Specific Requirements
    if (user.company_type) {
      fields.push({
        label: 'Preferred Company Type',
        value: user.company_type,
      });
    }

    if (user.years_in_business) {
      fields.push({
        label: 'Minimum Years in Business',
        value: user.years_in_business,
      });
    }

    if (user.preferred_entry_strategy) {
      fields.push({
        label: 'Entry Strategy',
        value: user.preferred_entry_strategy,
        key: 'preferred_entry_strategy'
      });
    }

    if (user.preferred_deal_structure) {
      fields.push({
        label: 'Deal Structure',
        value: user.preferred_deal_structure,
        key: 'preferred_deal_structure'
      });
    }

    // Operational Preferences
    if (typeof user.willing_to_relocate === 'boolean') {
      fields.push({
        label: 'Willing to Relocate',
        value: user.willing_to_relocate ? 'Yes' : 'No',
      });
    }

    if (typeof user.partner_in_operations === 'boolean') {
      fields.push({
        label: 'Partner in Operations',
        value: user.partner_in_operations ? 'Yes' : 'No',
      });
    }

    if (user.ownership_status) {
      fields.push({
        label: 'Ownership Status',
        value: user.ownership_status,
      });
    }

    if (typeof user.interest_in_franchises === 'boolean') {
      fields.push({
        label: 'Interest in Franchises',
        value: user.interest_in_franchises ? 'Yes' : 'No',
      });
    }

    // Special Criteria
    if (user.search_fund_status) {
      fields.push({
        label: 'Search Fund Status',
        value: user.search_fund_status,
      });
    }

    if (typeof user.add_on_only === 'boolean' && user.add_on_only) {
      fields.push({
        label: 'Investment Focus',
        value: 'Add-on acquisitions only',
      });
    }

    if (typeof user.platform_only === 'boolean' && user.platform_only) {
      fields.push({
        label: 'Investment Focus',
        value: 'Platform companies only',
      });
    }

    if (user.additional_thesis_details) {
      fields.push({
        label: 'Additional Criteria',
        value: user.additional_thesis_details,
        key: 'additional_thesis_details'
      });
    }

    if (fields.length === 0) return null;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
        {fields.map((field, idx) => (
          <div key={idx} className="space-y-2">
            <div className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.08em]">
              {field.label}
            </div>
            <div className="text-[14px] text-foreground/90">
              {field.value}
            </div>
          </div>
        ))}
      </div>
    );
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
