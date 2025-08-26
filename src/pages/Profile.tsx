
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
    flex_subXm_ebitda: user?.flex_subXm_ebitda || false,
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
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (value: string | string[], name: string) => {
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
      const { flex_subXm_ebitda, ...restForm } = formData as any;
      const normalizedData = {
        ...restForm,
        // Correct DB column name
        flex_subxm_ebitda: flex_subXm_ebitda ?? null,
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
                          <Input 
                            id="fund_size" 
                            name="fund_size" 
                            value={formData.fund_size || ""} 
                            onChange={handleInputChange}
                            placeholder="e.g. $100M-$500M"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="aum">Assets Under Management</Label>
                          <Input 
                            id="aum" 
                            name="aum" 
                            value={formData.aum || ""} 
                            onChange={handleInputChange}
                            placeholder="e.g. $500M"
                          />
                        </div>
                      </>
                    )}
                    
                    {formData.buyer_type === "corporate" && (
                      <div className="space-y-2">
                        <Label htmlFor="estimated_revenue">Your Company Revenue</Label>
                        <Input 
                          id="estimated_revenue" 
                          name="estimated_revenue" 
                          value={formData.estimated_revenue || ""} 
                          onChange={handleInputChange}
                          placeholder="e.g. $10M-$50M"
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
                         <Input 
                           id="deploying_capital_now" 
                           name="deploying_capital_now" 
                           value={formData.deploying_capital_now || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., Actively deploying"
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="portfolio_company_addon">Portfolio Company Add-on Interest</Label>
                         <Input 
                           id="portfolio_company_addon" 
                           name="portfolio_company_addon" 
                           value={formData.portfolio_company_addon || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., Yes, seeking add-ons for portfolio companies"
                         />
                       </div>
                     </>
                   )}

                   {formData.buyer_type === "corporate" && (
                     <>
                       <div className="space-y-2">
                         <Label htmlFor="owning_business_unit">Business Unit</Label>
                         <Input 
                           id="owning_business_unit" 
                           name="owning_business_unit" 
                           value={formData.owning_business_unit || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., Strategic Development"
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="deal_size_band">Deal Size Band</Label>
                         <Input 
                           id="deal_size_band" 
                           name="deal_size_band" 
                           value={formData.deal_size_band || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., $10M-$50M"
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="corpdev_intent">Corporate Development Intent</Label>
                         <Input 
                           id="corpdev_intent" 
                           name="corpdev_intent" 
                           value={formData.corpdev_intent || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., Strategic synergies"
                         />
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
                     <div className="space-y-2">
                       <Label htmlFor="discretion_type">Investment Discretion</Label>
                       <Input 
                         id="discretion_type" 
                         name="discretion_type" 
                         value={formData.discretion_type || ""} 
                         onChange={handleInputChange}
                         placeholder="e.g., Full discretion"
                       />
                     </div>
                   )}

                   {formData.buyer_type === "independentSponsor" && (
                     <>
                       <div className="space-y-2">
                         <Label htmlFor="committed_equity_band">Committed Equity</Label>
                         <Input 
                           id="committed_equity_band" 
                           name="committed_equity_band" 
                           value={formData.committed_equity_band || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., $5M-$15M"
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="deployment_timing">Deployment Timing</Label>
                         <Input 
                           id="deployment_timing" 
                           name="deployment_timing" 
                           value={formData.deployment_timing || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., 6-12 months"
                         />
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
                         <Label htmlFor="search_type">Search Fund Type</Label>
                         <Input 
                           id="search_type" 
                           name="search_type" 
                           value={formData.search_type || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., Traditional"
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="acq_equity_band">Acquisition Equity</Label>
                         <Input 
                           id="acq_equity_band" 
                           name="acq_equity_band" 
                           value={formData.acq_equity_band || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., $2M-$8M"
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="search_stage">Search Stage</Label>
                         <Input 
                           id="search_stage" 
                           name="search_stage" 
                           value={formData.search_stage || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., Active searching"
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="anchor_investors_summary">Anchor Investors</Label>
                         <Input 
                           id="anchor_investors_summary" 
                           name="anchor_investors_summary" 
                           value={formData.anchor_investors_summary || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., Stanford GSB, Wharton"
                         />
                       </div>
                     </>
                   )}

                   {formData.buyer_type === "advisor" && (
                     <>
                       <div className="space-y-2">
                         <Label htmlFor="on_behalf_of_buyer">On Behalf of Buyer</Label>
                         <Input 
                           id="on_behalf_of_buyer" 
                           name="on_behalf_of_buyer" 
                           value={formData.on_behalf_of_buyer || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., Yes, representing buyer"
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="buyer_role">Buyer Role</Label>
                         <Input 
                           id="buyer_role" 
                           name="buyer_role" 
                           value={formData.buyer_role || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., Investment banker"
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="mandate_blurb">Mandate Description</Label>
                         <Input 
                           id="mandate_blurb" 
                           name="mandate_blurb" 
                           value={formData.mandate_blurb || ""} 
                           onChange={handleInputChange}
                           placeholder="Brief mandate description"
                         />
                       </div>
                     </>
                   )}

                   {formData.buyer_type === "businessOwner" && (
                     <>
                       <div className="space-y-2">
                         <Label htmlFor="owner_intent">Owner Intent</Label>
                         <Input 
                           id="owner_intent" 
                           name="owner_intent" 
                           value={formData.owner_intent || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., Roll-up strategy"
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="owner_timeline">Owner Timeline</Label>
                         <Input 
                           id="owner_timeline" 
                           name="owner_timeline" 
                           value={formData.owner_timeline || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., 12-18 months"
                         />
                       </div>
                     </>
                   )}

                   {formData.buyer_type === "individual" && (
                     <>
                       <div className="space-y-2">
                         <Label htmlFor="uses_bank_finance">Uses Bank Finance</Label>
                         <Input 
                           id="uses_bank_finance" 
                           name="uses_bank_finance" 
                           value={formData.uses_bank_finance || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., Yes, SBA loans"
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="max_equity_today_band">Max Equity Today</Label>
                         <Input 
                           id="max_equity_today_band" 
                           name="max_equity_today_band" 
                           value={formData.max_equity_today_band || ""} 
                           onChange={handleInputChange}
                           placeholder="e.g., $2M-$5M"
                         />
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
