
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { DealAlertsTab } from "@/components/deal-alerts/DealAlertsTab";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { MultiCategorySelect } from "@/components/ui/category-select";
import { MultiLocationSelect } from "@/components/ui/location-select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { InvestmentSizeSelect } from "@/components/ui/investment-size-select";
import { EnhancedCurrencyInput } from "@/components/ui/enhanced-currency-input";
import { MultiSelect } from "@/components/ui/multi-select";
import { Switch } from "@/components/ui/switch";
import { 
  DEPLOYING_CAPITAL_OPTIONS,
  DEAL_SIZE_BAND_OPTIONS,
  INTEGRATION_PLAN_OPTIONS,
  CORPDEV_INTENT_OPTIONS,
  DISCRETION_TYPE_OPTIONS,
  COMMITTED_EQUITY_BAND_OPTIONS, 
  EQUITY_SOURCE_OPTIONS, 
  DEPLOYMENT_TIMING_OPTIONS,
  SEARCH_TYPE_OPTIONS,
  ACQ_EQUITY_BAND_OPTIONS,
  FINANCING_PLAN_OPTIONS,
  SEARCH_STAGE_OPTIONS,
  ON_BEHALF_OPTIONS,
  BUYER_ROLE_OPTIONS,
  OWNER_TIMELINE_OPTIONS,
  INDIVIDUAL_FUNDING_SOURCE_OPTIONS,
  USES_BANK_FINANCE_OPTIONS,
  MAX_EQUITY_TODAY_OPTIONS
} from "@/lib/signup-field-options";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@/types";
import { STANDARDIZED_CATEGORIES, STANDARDIZED_LOCATIONS } from "@/lib/financial-parser";
import { parseCurrency } from "@/lib/currency-utils";
import { standardizeCategories, standardizeLocations } from "@/lib/standardization";

const Profile = () => {
  const { user, updateUserProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [formData, setFormData] = useState<Partial<User>>({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    company: user?.company || "",
    website: user?.website || "",
    linkedin_profile: user?.linkedin_profile || "",
    phone_number: user?.phone_number || "",
    buyer_type: user?.buyer_type || "corporate",
    bio: user?.bio || "",
    ideal_target_description: user?.ideal_target_description || "",
    business_categories: user?.business_categories || [],
    target_locations: Array.isArray(user?.target_locations) ? user.target_locations : [],
    revenue_range_min: user?.revenue_range_min || undefined,
    revenue_range_max: user?.revenue_range_max || undefined,
    specific_business_search: user?.specific_business_search || "",
    // Add missing financial fields  
    investment_size: Array.isArray(user?.investment_size) ? user.investment_size : (user?.investment_size ? [user.investment_size] : []),
    fund_size: user?.fund_size || "",
    aum: user?.aum || "",
    estimated_revenue: user?.estimated_revenue || "",
    is_funded: user?.is_funded || "",
    funded_by: user?.funded_by || "",
    target_company_size: user?.target_company_size || "",
    funding_source: user?.funding_source || "",
    needs_loan: user?.needs_loan || "",
    ideal_target: user?.ideal_target || "",
    // Missing job_title field  
    job_title: user?.job_title || "",
    // All comprehensive buyer-specific fields
    deploying_capital_now: user?.deploying_capital_now || "",
    owning_business_unit: user?.owning_business_unit || "",
    deal_size_band: user?.deal_size_band || "",
    buyer_org_url: user?.buyer_org_url || "",
    integration_plan: user?.integration_plan || [],
    corpdev_intent: user?.corpdev_intent || "",
    discretion_type: user?.discretion_type || "",
    committed_equity_band: user?.committed_equity_band || "",
    equity_source: user?.equity_source || [],
    deployment_timing: user?.deployment_timing || "",
    target_deal_size_min: user?.target_deal_size_min || null,
    target_deal_size_max: user?.target_deal_size_max || null,
    geographic_focus: user?.geographic_focus || [],
    industry_expertise: user?.industry_expertise || [],
    deal_structure_preference: user?.deal_structure_preference || "",
    permanent_capital: user?.permanent_capital || false,
    operating_company_targets: user?.operating_company_targets || [],
    flex_subxm_ebitda: user?.flex_subxm_ebitda || false,
    search_type: user?.search_type || "",
    acq_equity_band: user?.acq_equity_band || "",
    financing_plan: user?.financing_plan || [],
    search_stage: user?.search_stage || "",
    flex_sub2m_ebitda: user?.flex_sub2m_ebitda || false,
    on_behalf_of_buyer: user?.on_behalf_of_buyer || "",
    buyer_role: user?.buyer_role || "",
    owner_timeline: user?.owner_timeline || "",
    owner_intent: user?.owner_intent || "",
    uses_bank_finance: user?.uses_bank_finance || "",
    max_equity_today_band: user?.max_equity_today_band || "",
    mandate_blurb: user?.mandate_blurb || "",
    portfolio_company_addon: user?.portfolio_company_addon || "",
    backers_summary: user?.backers_summary || "",
    anchor_investors_summary: user?.anchor_investors_summary || "",
    // New Step 4 fields
    deal_intent: user?.deal_intent || "",
    exclusions: user?.exclusions || [],
    include_keywords: user?.include_keywords || [],
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (value: string | string[] | boolean, name: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLocationChange = (values: string[]) => {
    setFormData((prev) => ({
      ...prev,
      target_locations: values as any,
    }));
  };

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Normalize currency fields and standardize categories/locations before sending
      const normalizedData = {
        ...formData,
        // Ensure correct DB column names
        flex_subxm_ebitda: formData.flex_subxm_ebitda ?? null,
        revenue_range_min: formData.revenue_range_min || null,
        revenue_range_max: formData.revenue_range_max || null,
        // Standardize business categories and target locations
        business_categories: formData.business_categories ? standardizeCategories(formData.business_categories as any) : [],
        target_locations: formData.target_locations ? standardizeLocations(formData.target_locations as any) : [],
      };
      
      await updateUserProfile(normalizedData);
      toast({
        title: "Profile updated",
        description: "Your profile information has been successfully updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Something went wrong while updating your profile.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    
    // Validate password inputs
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    
    setIsLoading(true);
    try {
      // Update password via Supabase
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });
      
      if (error) throw error;
      
      // Reset form and show success message
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordSuccess("Password updated successfully");
      
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
    } catch (error: any) {
      console.error("Password update error:", error);
      setPasswordError(error.message || "Failed to update password");
      toast({
        variant: "destructive",
        title: "Password update failed",
        description: error.message || "Something went wrong while updating your password.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-6">My Profile</h1>
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile Information</TabsTrigger>
          <TabsTrigger value="deal-alerts">Deal Alerts</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your profile information and preferences.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      name="email" 
                      value={user.email} 
                      disabled 
                      className="bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="buyer_type">Buyer Type</Label>
                    <Select 
                      value={formData.buyer_type} 
                      onValueChange={(value) => handleSelectChange(value, "buyer_type")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a buyer type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="privateEquity">Private Equity</SelectItem>
                        <SelectItem value="familyOffice">Family Office</SelectItem>
                        <SelectItem value="searchFund">Search Fund</SelectItem>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="independentSponsor">Independent Sponsor</SelectItem>
                        <SelectItem value="advisor">Advisor / Banker</SelectItem>
                        <SelectItem value="businessOwner">Business Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input 
                      id="first_name" 
                      name="first_name" 
                      value={formData.first_name} 
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input 
                      id="last_name" 
                      name="last_name" 
                      value={formData.last_name} 
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input 
                      id="company" 
                      name="company" 
                      value={formData.company} 
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input 
                      id="website" 
                      name="website" 
                      value={formData.website} 
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="linkedin_profile">LinkedIn Profile</Label>
                    <Input 
                      id="linkedin_profile" 
                      name="linkedin_profile" 
                      value={formData.linkedin_profile} 
                      onChange={handleInputChange}
                      placeholder="https://www.linkedin.com/in/yourprofile"
                    />
                  </div>
                  
                   <div className="space-y-2">
                     <Label htmlFor="phone_number">Phone Number</Label>
                     <Input 
                       id="phone_number" 
                       name="phone_number" 
                       value={formData.phone_number} 
                       onChange={handleInputChange}
                     />
                   </div>
                   
                   <div className="space-y-2">
                     <Label htmlFor="job_title">Job Title</Label>
                     <Input 
                       id="job_title" 
                       name="job_title" 
                       value={formData.job_title || ""} 
                       onChange={handleInputChange}
                       placeholder="e.g., Partner, VP Business Development, Investment Associate"
                     />
                   </div>
                  
                   <div className="space-y-2">
                     <Label htmlFor="target_locations">Target Locations</Label>
                      <MultiLocationSelect
                        value={Array.isArray(formData.target_locations) ? formData.target_locations : []}
                        onValueChange={handleLocationChange}
                        placeholder="Select target regions..."
                      />
                   </div>
                </div>
                
                <Separator />
                
                {/* Investment Criteria Section */}
                <div className="space-y-6">
                  <h3 className="text-lg font-medium">Investment Criteria</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {/* Investment Size - for all buyer types */}
                    <div className="space-y-2">
                      <Label htmlFor="investment_size">Investment Size Range</Label>
                       <InvestmentSizeSelect
                        value={Array.isArray(formData.investment_size) ? formData.investment_size : (formData.investment_size ? [formData.investment_size] : [])}
                        onValueChange={(values) => handleSelectChange(values, "investment_size")}
                        placeholder="Select investment size ranges..."
                      />
                    </div>

                    {/* Additional fields based on buyer type */}
                    {(formData.buyer_type === "privateEquity" || formData.buyer_type === "familyOffice") && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="fund_size">Fund Size</Label>
                          <EnhancedCurrencyInput
                            id="fund_size" 
                            name="fund_size" 
                            value={formData.fund_size || ""} 
                            onChange={(value) => handleInputChange({ target: { name: 'fund_size', value } } as any)}
                            fieldType="fund"
                            currencyMode="millions"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="aum">Assets Under Management</Label>
                          <EnhancedCurrencyInput
                            id="aum" 
                            name="aum" 
                            value={formData.aum || ""} 
                            onChange={(value) => handleInputChange({ target: { name: 'aum', value } } as any)}
                            fieldType="aum"
                            currencyMode="millions"
                          />
                        </div>
                      </>
                    )}
                    
                    {formData.buyer_type === "corporate" && (
                      <div className="space-y-2">
                        <Label htmlFor="estimated_revenue">Your Company Revenue</Label>
                        <EnhancedCurrencyInput
                          id="estimated_revenue" 
                          name="estimated_revenue" 
                          value={formData.estimated_revenue || ""} 
                          onChange={(value) => handleInputChange({ target: { name: 'estimated_revenue', value } } as any)}
                          fieldType="revenue"
                          currencyMode="millions"
                        />
                      </div>
                    )}

                    {formData.buyer_type === "searchFund" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="is_funded">Funding Status</Label>
                          <Select 
                            value={formData.is_funded} 
                            onValueChange={(value) => handleSelectChange(value, "is_funded")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select funding status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">Funded</SelectItem>
                              <SelectItem value="no">Not Funded</SelectItem>
                              <SelectItem value="seeking">Seeking Funding</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {formData.is_funded === "yes" && (
                          <div className="space-y-2">
                            <Label htmlFor="funded_by">Funded By</Label>
                            <Input 
                              id="funded_by" 
                              name="funded_by" 
                              value={formData.funded_by || ""} 
                              onChange={handleInputChange}
                              placeholder="Name of investor/fund"
                            />
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <Label htmlFor="target_company_size">Target Company Size</Label>
                          <Select 
                            value={formData.target_company_size} 
                            onValueChange={(value) => handleSelectChange(value, "target_company_size")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select target size" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="small">Small (under $5M revenue)</SelectItem>
                              <SelectItem value="medium">Medium ($5M-$50M revenue)</SelectItem>
                              <SelectItem value="large">Large (over $50M revenue)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {formData.buyer_type === "individual" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="funding_source">Primary Funding Source</Label>
                          <Select 
                            value={formData.funding_source} 
                            onValueChange={(value) => handleSelectChange(value, "funding_source")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select funding source" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="personal">Personal Funds</SelectItem>
                              <SelectItem value="investors">External Investors</SelectItem>
                              <SelectItem value="bank_loan">Bank Loan</SelectItem>
                              <SelectItem value="sba_loan">SBA Loan</SelectItem>
                              <SelectItem value="combination">Combination</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="needs_loan">SBA/Bank Loan Interest</Label>
                          <Select 
                            value={formData.needs_loan} 
                            onValueChange={(value) => handleSelectChange(value, "needs_loan")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select loan interest" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">Yes</SelectItem>
                              <SelectItem value="no">No</SelectItem>
                              <SelectItem value="maybe">Maybe</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="ideal_target">Ideal Target Type</Label>
                          <Input 
                            id="ideal_target" 
                            name="ideal_target" 
                            value={formData.ideal_target || ""} 
                            onChange={handleInputChange}
                            placeholder="e.g. lifestyle business, growth company"
                          />
                        </div>
                      </>
                      )}
                   </div>

                   {/* Buyer-specific additional fields */}
                    {formData.buyer_type === "privateEquity" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="deploying_capital_now">Capital Deployment Status</Label>
                          <Select 
                            value={formData.deploying_capital_now || ""} 
                            onValueChange={(value) => handleSelectChange(value, "deploying_capital_now")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select deployment status" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPLOYING_CAPITAL_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="portfolio_company_addon">Portfolio Company Add-on (Optional)</Label>
                          <Input 
                            id="portfolio_company_addon" 
                            name="portfolio_company_addon" 
                            value={formData.portfolio_company_addon || ""} 
                            onChange={handleInputChange}
                            placeholder="Which portfolio company would this be an add-on to?"
                          />
                        </div>
                      </>
                    )}

                    {formData.buyer_type === "corporate" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="owning_business_unit">Owning Business Unit / Brand (Optional)</Label>
                          <Input 
                            id="owning_business_unit" 
                            name="owning_business_unit" 
                            value={formData.owning_business_unit || ""} 
                            onChange={handleInputChange}
                            placeholder="Which business unit would own this acquisition?"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="deal_size_band">Deal Size (EV)</Label>
                          <Select 
                            value={formData.deal_size_band || ""} 
                            onValueChange={(value) => handleSelectChange(value, "deal_size_band")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select deal size range" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEAL_SIZE_BAND_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="integration_plan">Integration Plan (Optional)</Label>
                          <MultiSelect
                            options={INTEGRATION_PLAN_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
                            selected={Array.isArray(formData.integration_plan) ? formData.integration_plan : (formData.integration_plan ? [formData.integration_plan] : [])}
                            onSelectedChange={(values) => handleSelectChange(values, "integration_plan")}
                            placeholder="Select integration approaches"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="corpdev_intent">Speed/Intent (Optional)</Label>
                          <Select 
                            value={formData.corpdev_intent || ""} 
                            onValueChange={(value) => handleSelectChange(value, "corpdev_intent")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select your current intent" />
                            </SelectTrigger>
                            <SelectContent>
                              {CORPDEV_INTENT_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="buyer_org_url">Organization URL</Label>
                          <Input 
                            id="buyer_org_url" 
                            name="buyer_org_url" 
                            value={formData.buyer_org_url || ""} 
                            onChange={handleInputChange}
                            placeholder="https://company.com"
                          />
                        </div>
                      </>
                    )}

                    {formData.buyer_type === "familyOffice" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="discretion_type">Decision Authority</Label>
                          <Select 
                            value={formData.discretion_type || ""} 
                            onValueChange={(value) => handleSelectChange(value, "discretion_type")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select decision authority" />
                            </SelectTrigger>
                            <SelectContent>
                              {DISCRETION_TYPE_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="permanent_capital"
                            checked={formData.permanent_capital || false}
                            onCheckedChange={(checked) => handleSelectChange(checked, "permanent_capital")}
                          />
                          <Label htmlFor="permanent_capital">Permanent Capital</Label>
                        </div>
                      </>
                    )}

                    {formData.buyer_type === "independentSponsor" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="committed_equity_band">Committed Equity</Label>
                          <Select value={formData.committed_equity_band || ""} onValueChange={(value) => handleSelectChange(value, "committed_equity_band")}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select committed equity range" />
                            </SelectTrigger>
                            <SelectContent>
                              {COMMITTED_EQUITY_BAND_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="equity_source">Equity Source</Label>
                          <MultiSelect
                            options={EQUITY_SOURCE_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
                            selected={Array.isArray(formData.equity_source) ? formData.equity_source : (formData.equity_source ? [formData.equity_source] : [])}
                            onSelectedChange={(values) => handleSelectChange(values, "equity_source")}
                            placeholder="Select equity sources..."
                            className="w-full"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="deployment_timing">Deployment Timing</Label>
                          <Select value={formData.deployment_timing || ""} onValueChange={(value) => handleSelectChange(value, "deployment_timing")}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select deployment timing" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPLOYMENT_TIMING_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            id="flex_subxm_ebitda"
                            checked={formData.flex_subxm_ebitda || false}
                            onCheckedChange={(checked) => handleSelectChange(checked, "flex_subxm_ebitda")}
                          />
                          <Label htmlFor="flex_subxm_ebitda">Flexible on sub-$1M EBITDA targets</Label>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="backers_summary">Backers Summary</Label>
                          <Input 
                            id="backers_summary" 
                            name="backers_summary" 
                            value={formData.backers_summary || ""} 
                            onChange={handleInputChange}
                            placeholder="e.g., Smith Capital; Oak Family Office"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="deal_structure_preference">Deal Structure Preference</Label>
                          <Input 
                            id="deal_structure_preference" 
                            name="deal_structure_preference" 
                            value={formData.deal_structure_preference || ""} 
                            onChange={handleInputChange}
                            placeholder="e.g., Majority control"
                          />
                        </div>
                      </>
                    )}

                   {formData.buyer_type === "searchFund" && (
                     <>
                       <div className="space-y-2">
                         <Label htmlFor="search_type">Search Type</Label>
                         <Select 
                           value={formData.search_type || ""} 
                           onValueChange={(value) => handleSelectChange(value, "search_type")}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select search type" />
                           </SelectTrigger>
                           <SelectContent>
                             {SEARCH_TYPE_OPTIONS.map(option => (
                               <SelectItem key={option.value} value={option.value}>
                                 {option.label}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="acq_equity_band">Equity Available for Acquisition at Close</Label>
                         <Select 
                           value={formData.acq_equity_band || ""} 
                           onValueChange={(value) => handleSelectChange(value, "acq_equity_band")}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select equity available" />
                           </SelectTrigger>
                           <SelectContent>
                             {ACQ_EQUITY_BAND_OPTIONS.map(option => (
                               <SelectItem key={option.value} value={option.value}>
                                 {option.label}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="financing_plan">Financing Plan</Label>
                         <MultiSelect
                           options={FINANCING_PLAN_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
                           selected={Array.isArray(formData.financing_plan) ? formData.financing_plan : (formData.financing_plan ? [formData.financing_plan] : [])}
                           onSelectedChange={(values) => handleSelectChange(values, "financing_plan")}
                           placeholder="Select all that apply"
                         />
                       </div>
                       <div className="flex items-center space-x-2">
                         <Switch
                           id="flex_sub2m_ebitda"
                           checked={formData.flex_sub2m_ebitda || false}
                           onCheckedChange={(checked) => handleSelectChange(checked, "flex_sub2m_ebitda")}
                         />
                         <Label htmlFor="flex_sub2m_ebitda">Flexible on size? (can pursue less than $2M EBITDA)</Label>
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="search_stage">Stage of Search (Optional)</Label>
                         <Select 
                           value={formData.search_stage || ""} 
                           onValueChange={(value) => handleSelectChange(value, "search_stage")}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select current stage" />
                           </SelectTrigger>
                           <SelectContent>
                             {SEARCH_STAGE_OPTIONS.map(option => (
                               <SelectItem key={option.value} value={option.value}>
                                 {option.label}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="anchor_investors_summary">Anchor Investors / Committed Backers (Optional)</Label>
                         <Input 
                           id="anchor_investors_summary" 
                           name="anchor_investors_summary" 
                           value={formData.anchor_investors_summary || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., XYZ Capital; ABC Family Office"
                         />
                       </div>
                     </>
                   )}

                   {formData.buyer_type === "advisor" && (
                     <>
                       <div className="space-y-2">
                         <Label htmlFor="on_behalf_of_buyer">Are you inquiring on behalf of a capitalized buyer with discretion?</Label>
                         <Select 
                           value={formData.on_behalf_of_buyer || ""} 
                           onValueChange={(value) => handleSelectChange(value, "on_behalf_of_buyer")}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select yes or no" />
                           </SelectTrigger>
                           <SelectContent>
                             {ON_BEHALF_OPTIONS.map(option => (
                               <SelectItem key={option.value} value={option.value}>
                                 {option.label}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       {formData.on_behalf_of_buyer === "yes" && (
                         <>
                           <div className="space-y-2">
                             <Label htmlFor="buyer_role">Buyer Role</Label>
                             <Select 
                               value={formData.buyer_role || ""} 
                               onValueChange={(value) => handleSelectChange(value, "buyer_role")}
                             >
                               <SelectTrigger>
                                 <SelectValue placeholder="Select buyer role" />
                               </SelectTrigger>
                               <SelectContent>
                                 {BUYER_ROLE_OPTIONS.map(option => (
                                   <SelectItem key={option.value} value={option.value}>
                                     {option.label}
                                   </SelectItem>
                                 ))}
                               </SelectContent>
                             </Select>
                           </div>
                           <div className="space-y-2">
                             <Label htmlFor="buyer_org_url">Buyer Organization Website</Label>
                             <Input 
                               id="buyer_org_url" 
                               name="buyer_org_url" 
                               value={formData.buyer_org_url || ""} 
                               onChange={handleInputChange}
                               placeholder="https://example.com"
                             />
                           </div>
                         </>
                       )}
                       <div className="space-y-2">
                         <Label htmlFor="mandate_blurb">Mandate in One Line (≤140 chars, Optional)</Label>
                         <Textarea 
                           id="mandate_blurb" 
                           name="mandate_blurb" 
                           value={formData.mandate_blurb || ""} 
                           onChange={handleInputChange}
                           placeholder="Brief description of your mandate or focus"
                           maxLength={140}
                         />
                       </div>
                     </>
                   )}

                   {formData.buyer_type === "businessOwner" && (
                     <>
                       <div className="space-y-2">
                         <Label htmlFor="owner_intent">Why are you here? (≤140 chars)</Label>
                         <Textarea 
                           id="owner_intent" 
                           name="owner_intent" 
                           value={formData.owner_intent || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., Valuation, Open to intros"
                           maxLength={140}
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="owner_timeline">Timeline (Optional)</Label>
                         <Select 
                           value={formData.owner_timeline || ""} 
                           onValueChange={(value) => handleSelectChange(value, "owner_timeline")}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select timeline" />
                           </SelectTrigger>
                           <SelectContent>
                             {OWNER_TIMELINE_OPTIONS.map(option => (
                               <SelectItem key={option.value} value={option.value}>
                                 {option.label}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                     </>
                   )}

                   {formData.buyer_type === "individual" && (
                     <>
                       <div className="space-y-2">
                         <Label htmlFor="funding_source">Funding Source</Label>
                         <Select 
                           value={formData.funding_source || ""} 
                           onValueChange={(value) => handleSelectChange(value, "funding_source")}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select funding source" />
                           </SelectTrigger>
                           <SelectContent>
                             {INDIVIDUAL_FUNDING_SOURCE_OPTIONS.map(option => (
                               <SelectItem key={option.value} value={option.value}>
                                 {option.label}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="uses_bank_finance">Will you use SBA/bank financing?</Label>
                         <Select 
                           value={formData.uses_bank_finance || ""} 
                           onValueChange={(value) => handleSelectChange(value, "uses_bank_finance")}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select yes, no, or not sure" />
                           </SelectTrigger>
                           <SelectContent>
                             {USES_BANK_FINANCE_OPTIONS.map(option => (
                               <SelectItem key={option.value} value={option.value}>
                                 {option.label}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="max_equity_today_band">Max Equity You Can Commit Today (Optional)</Label>
                         <Select 
                           value={formData.max_equity_today_band || ""} 
                           onValueChange={(value) => handleSelectChange(value, "max_equity_today_band")}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select equity range" />
                           </SelectTrigger>
                           <SelectContent>
                             {MAX_EQUITY_TODAY_OPTIONS.map(option => (
                               <SelectItem key={option.value} value={option.value}>
                                 {option.label}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                     </>
                   )}
                 </div>
                 
                 <Separator />
                 
                 <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="ideal_target_description">Ideal Target Description</Label>
                    <Textarea 
                      id="ideal_target_description" 
                      name="ideal_target_description" 
                      value={formData.ideal_target_description || ""} 
                      onChange={handleInputChange}
                      placeholder="Describe your ideal acquisition target or investment criteria..."
                      className="min-h-[100px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="business_categories">Business Categories of Interest</Label>
                     <MultiCategorySelect
                       value={formData.business_categories || []}
                       onValueChange={(value) => handleSelectChange(value, "business_categories")}
                       placeholder="Select business categories..."
                       className="w-full"
                     />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                     <div className="space-y-2">
                       <Label htmlFor="revenue_range_min">Revenue Range (Min)</Label>
                       <CurrencyInput
                         id="revenue_range_min"
                         name="revenue_range_min"
                         placeholder="Minimum revenue"
                         value={formData.revenue_range_min || ""}
                         onChange={(value) => setFormData(prev => ({ ...prev, revenue_range_min: value as any }))}
                       />
                     </div>
                     
                     <div className="space-y-2">
                       <Label htmlFor="revenue_range_max">Revenue Range (Max)</Label>
                       <CurrencyInput
                         id="revenue_range_max"
                         name="revenue_range_max"
                         placeholder="Maximum revenue"
                         value={formData.revenue_range_max || ""}
                         onChange={(value) => setFormData(prev => ({ ...prev, revenue_range_max: value as any }))}
                       />
                     </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="specific_business_search">Specific Business Search</Label>
                    <Textarea 
                      id="specific_business_search" 
                      name="specific_business_search" 
                      value={formData.specific_business_search || ""} 
                      onChange={handleInputChange}
                      placeholder="Describe any specific types of businesses you're looking for..."
                      className="min-h-[80px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bio">About Me / Bio</Label>
                    <Textarea 
                      id="bio" 
                      name="bio" 
                      value={formData.bio || ""} 
                      onChange={handleInputChange}
                      placeholder="Tell us about yourself and your investment interests..."
                      className="min-h-[120px]"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="deal-alerts">
          <DealAlertsTab />
        </TabsContent>
        
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>
                Update your password and security settings.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-6">
                {passwordSuccess && (
                  <div className="flex items-center p-4 mb-4 text-sm text-green-800 border border-green-300 rounded-lg bg-green-50">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}
                
                {passwordError && (
                  <div className="flex items-center p-4 mb-4 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span>{passwordError}</span>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input 
                    id="currentPassword"
                    name="currentPassword"
                    type="password" 
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input 
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input 
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Change Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;
