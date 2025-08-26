import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BuyerType, User } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { parseCurrency } from "@/lib/currency-utils";

const steps = [
  "Account Information",
  "Personal Details", 
  "Buyer Type",
  "Buyer Profile",
];

import { STANDARDIZED_CATEGORIES } from "@/lib/financial-parser";
import { MultiCategorySelect } from "@/components/ui/category-select";
import { MultiLocationSelect } from "@/components/ui/location-select";
import { EnhancedMultiCategorySelect } from "@/components/ui/enhanced-category-select";
import { EnhancedMultiLocationSelect } from "@/components/ui/enhanced-location-select";
import { FIELD_HELPERS } from "@/lib/field-helpers";
import { REVENUE_RANGES, FUND_AUM_RANGES, INVESTMENT_RANGES, DEAL_SIZE_RANGES } from "@/lib/currency-ranges";
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

const buyerTypeOptions = [
  { value: "corporate", label: "Corporate Development (Strategic)", description: "Corporate buyers seeking strategic acquisitions" },
  { value: "privateEquity", label: "Private Equity", description: "Investment funds focused on acquiring and growing companies" },
  { value: "familyOffice", label: "Family Office", description: "Private wealth management offices making direct investments" },
  { value: "searchFund", label: "Search Fund", description: "Entrepreneur-led acquisition vehicles" },
  { value: "individual", label: "Individual Investor", description: "High-net-worth individuals making personal investments" },
  { value: "independentSponsor", label: "Independent Sponsor", description: "Deal-by-deal investment professionals" },
  { value: "advisor", label: "Advisor / Banker", description: "Investment bankers and M&A advisors" },
  { value: "businessOwner", label: "Business Owner", description: "Current business owners exploring opportunities" },
];

const Signup = () => {
  const { signup, isLoading } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    company: string;
    website: string;
    linkedinProfile: string;
    phoneNumber: string;
    jobTitle?: string;
    buyerType: BuyerType | "";
    // Buyer type specific fields - flattened for proper mapping
    estimatedRevenue: string;
    fundSize: string;
    investmentSize: string;
    aum: string;
    isFunded: string;
    fundedBy: string;
    targetCompanySize: string;
    fundingSource: string;
    needsLoan: string;
    idealTarget: string;
    // Profile fields
    idealTargetDescription: string;
    businessCategories: string[];
    targetLocations: string[];
    revenueRangeMin: string;
    revenueRangeMax: string;
    specificBusinessSearch: string;
    // Independent sponsor specific fields
    targetDealSizeMin: string;
    targetDealSizeMax: string;
    geographicFocus: string;
    industryExpertise: string;
    dealStructurePreference: string;
    // New comprehensive signup fields
    portfolioCompanyAddon?: string;
    deployingCapitalNow?: string;
    owningBusinessUnit?: string;
    dealSizeBand?: string;
    integrationPlan?: string[];
    corpdevIntent?: string;
    discretionType?: string;
    permanentCapital?: boolean;
    operatingCompanyTargets?: string[];
    committedEquityBand?: string;
    equitySource?: string[];
    flexSubxmEbitda?: boolean;
    backersSummary?: string;
    deploymentTiming?: string;
    searchType?: string;
    acqEquityBand?: string;
    financingPlan?: string[];
    flexSub2mEbitda?: boolean;
    anchorInvestorsSummary?: string;
    searchStage?: string;
    onBehalfOfBuyer?: string;
    buyerRole?: string;
    buyerOrgUrl?: string;
    mandateBlurb?: string;
    ownerIntent?: string;
    ownerTimeline?: string;
    usesBank?: string;
    maxEquityToday?: string;
  }>({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    company: "",
    website: "",
    linkedinProfile: "",
    phoneNumber: "",
    jobTitle: "",
    buyerType: "",
    // Buyer type specific fields
    estimatedRevenue: "",
    fundSize: "",
    investmentSize: "",
    aum: "",
    isFunded: "",
    fundedBy: "",
    targetCompanySize: "",
    fundingSource: "",
    needsLoan: "",
    idealTarget: "",
    // Profile fields
    idealTargetDescription: "",
    businessCategories: [],
    targetLocations: [],
    revenueRangeMin: "",
    revenueRangeMax: "",
    specificBusinessSearch: "",
    // Independent sponsor specific fields
    targetDealSizeMin: "",
    targetDealSizeMax: "",
    geographicFocus: "",
    industryExpertise: "",
    dealStructurePreference: "",
    // New comprehensive signup fields
    portfolioCompanyAddon: "",
    deployingCapitalNow: "",
    owningBusinessUnit: "",
    dealSizeBand: "",
    integrationPlan: [],
    corpdevIntent: "",
    discretionType: "",
    permanentCapital: false,
    operatingCompanyTargets: [],
    committedEquityBand: "",
    equitySource: [],
    flexSubxmEbitda: false,
    backersSummary: "",
    deploymentTiming: "",
    searchType: "",
    acqEquityBand: "",
    financingPlan: [],
    flexSub2mEbitda: false,
    anchorInvestorsSummary: "",
    searchStage: "",
    onBehalfOfBuyer: "",
    buyerRole: "",
    buyerOrgUrl: "",
    mandateBlurb: "",
    ownerIntent: "",
    ownerTimeline: "",
    usesBank: "",
    maxEquityToday: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBuyerSpecificChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBuyerTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      buyerType: value as BuyerType,
      // Reset buyer-specific fields when type changes
      estimatedRevenue: "",
      fundSize: "",
      investmentSize: "",
      aum: "",
      isFunded: "",
      fundedBy: "",
      targetCompanySize: "",
      fundingSource: "",
      needsLoan: "",
      idealTarget: "",
      // Reset independent sponsor fields
      targetDealSizeMin: "",
      targetDealSizeMax: "",
      geographicFocus: "",
      industryExpertise: "",
      dealStructurePreference: "",
    }));
  };

  const handleBusinessCategoryChange = (categoryValue: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      businessCategories: checked
        ? [...prev.businessCategories, categoryValue]
        : prev.businessCategories.filter((cat) => cat !== categoryValue),
    }));
  };

  const validateStep = (): boolean => {
    const errors: string[] = [];
    
    switch (currentStep) {
      case 0: {
        // Email validation
        if (!formData.email) {
          errors.push("Email is required");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          errors.push("Please enter a valid email address");
        }
        
        // Password validation
        if (!formData.password) {
          errors.push("Password is required");
        } else if (formData.password.length < 6) {
          errors.push("Password must be at least 6 characters");
        }
        
        // Confirm password validation
        if (formData.password !== formData.confirmPassword) {
          errors.push("Passwords do not match");
        }
        break;
      }
      case 1: {
        // Name validation
        if (!formData.firstName) {
          errors.push("First name is required");
        }
        if (!formData.lastName) {
          errors.push("Last name is required");
        }
        // Company validation
        if (!formData.company) {
          errors.push("Company name is required");
        }
        // Phone validation
        if (!formData.phoneNumber) {
          errors.push("Phone number is required");
        }
        // Website validation - optional but validate format if provided
        if (formData.website && !formData.website.match(/^https?:\/\/.+/)) {
          errors.push("Please enter a valid website URL (must start with http:// or https://)");
        }
        // LinkedIn validation - optional but validate format if provided
        if (formData.linkedinProfile && !formData.linkedinProfile.match(/^https?:\/\/(www\.)?linkedin\.com\/.+/)) {
          errors.push("Please enter a valid LinkedIn URL");
        }
        break;
      }
      case 2: {
        // Buyer type validation
        if (!formData.buyerType) {
          errors.push("Please select a buyer type");
        }
        
        // Specific validations based on buyer type
        switch (formData.buyerType) {
          case "corporate":
            if (!formData.estimatedRevenue) {
              errors.push("Estimated revenue is required");
            }
            if (!formData.dealSizeBand) {
              errors.push("Deal size (EV) is required");
            }
            break;
          case "privateEquity":
            if (!formData.fundSize) {
              errors.push("Fund size is required");
            }
            if (!formData.deployingCapitalNow) {
              errors.push("Deploying capital status is required");
            }
            break;
          case "familyOffice":
            if (!formData.fundSize) {
              errors.push("Fund size is required");
            }
            if (!formData.discretionType) {
              errors.push("Decision authority is required");
            }
            break;
          case "searchFund":
            if (!formData.searchType) {
              errors.push("Search type is required");
            }
            if (!formData.acqEquityBand) {
              errors.push("Equity available for acquisition is required");
            }
            if (!formData.financingPlan || formData.financingPlan.length === 0) {
              errors.push("At least one financing plan option is required");
            }
            if (formData.flexSub2mEbitda === undefined) {
              errors.push("Please specify if you're flexible on size");
            }
            break;
          case "individual":
            if (!formData.fundingSource) {
              errors.push("Funding source is required");
            }
            if (!formData.usesBank) {
              errors.push("Please specify if you'll use SBA/bank financing");
            }
            break;
          case "independentSponsor":
            if (!formData.committedEquityBand) {
              errors.push("Committed equity amount is required");
            }
            if (!formData.equitySource || formData.equitySource.length === 0) {
              errors.push("At least one equity source is required");
            }
            if (formData.flexSubxmEbitda === undefined) {
              errors.push("Please specify if you're flexible on size");
            }
            break;
          case "advisor":
            if (!formData.onBehalfOfBuyer) {
              errors.push("Please specify if you're representing a buyer");
            }
            if (formData.onBehalfOfBuyer === "yes") {
              if (!formData.buyerRole) {
                errors.push("Buyer role is required");
              }
              if (!formData.buyerOrgUrl) {
                errors.push("Buyer organization website is required");
              }
            }
            break;
          case "businessOwner":
            if (!formData.ownerIntent) {
              errors.push("Please describe why you're here");
            }
            break;
        }
        break;
      }
      case 3: {
        // Enhanced validation
        if (!formData.idealTargetDescription.trim() || formData.idealTargetDescription.length < 10) {
          errors.push("Please provide at least 10 characters describing your ideal targets");
        }
        // Business categories validation
        if (formData.businessCategories.length === 0) {
          errors.push("Please select at least one business category");
        }
        // Target locations validation  
        if (formData.targetLocations.length === 0) {
          errors.push("Please select at least one target location");
        }
        if (formData.revenueRangeMin && formData.revenueRangeMax) {
          const minIdx = REVENUE_RANGES.findIndex(r => r.value === formData.revenueRangeMin);
          const maxIdx = REVENUE_RANGES.findIndex(r => r.value === formData.revenueRangeMax);
          if (minIdx !== -1 && maxIdx !== -1 && minIdx >= maxIdx) {
            errors.push("Maximum revenue must be greater than minimum revenue");
          }
        }
        // Independent sponsor specific validation
        if (formData.buyerType === 'independentSponsor') {
          if (formData.targetDealSizeMin && formData.targetDealSizeMax) {
            const min = parseCurrency(formData.targetDealSizeMin);
            const max = parseCurrency(formData.targetDealSizeMax);
            if (min >= max) {
              errors.push("Maximum deal size must be greater than minimum deal size");
            }
          }
        }
        break;
      }
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    } else {
      // Scroll to top to show validation errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep()) {
      // Scroll to top to show validation errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare user data for signup
      const { 
        firstName, 
        lastName, 
        email, 
        company, 
        website, 
        linkedinProfile, 
        phoneNumber, 
        buyerType,
        estimatedRevenue,
        fundSize,
        investmentSize,
        aum,
        isFunded,
        fundedBy,
        targetCompanySize,
        fundingSource,
        needsLoan,
        idealTarget,
        idealTargetDescription,
        businessCategories,
        targetLocations,
        revenueRangeMin,
        revenueRangeMax,
        specificBusinessSearch,
        targetDealSizeMin,
        targetDealSizeMax,
        geographicFocus,
        industryExpertise,
        dealStructurePreference
      } = formData;
      
      const signupData: Partial<User> = {
        first_name: firstName,
        last_name: lastName,
        email: email,
        company: company,
        website: website,
        linkedin_profile: linkedinProfile,
        phone_number: phoneNumber,
        buyer_type: buyerType as BuyerType,
        ideal_target_description: idealTargetDescription,
        business_categories: businessCategories,
        target_locations: targetLocations as any,
        revenue_range_min: revenueRangeMin || undefined,
        revenue_range_max: revenueRangeMax || undefined,
        specific_business_search: specificBusinessSearch,
        // Missing job_title field
        job_title: formData.jobTitle || '',
        // Buyer-specific fields
        estimated_revenue: estimatedRevenue,
        fund_size: fundSize,
        investment_size: investmentSize,
        aum: aum,
        is_funded: isFunded,
        funded_by: fundedBy,
        target_company_size: targetCompanySize,
        funding_source: fundingSource,
        needs_loan: needsLoan,
        ideal_target: idealTarget,
        // All new buyer-specific fields from form
        // Private Equity
        deploying_capital_now: formData.deployingCapitalNow || '',
        // Corporate Development
        owning_business_unit: formData.owningBusinessUnit || '',
        deal_size_band: formData.dealSizeBand || '',
        buyer_org_url: formData.buyerOrgUrl || '',
        integration_plan: formData.integrationPlan || [],
        corpdev_intent: formData.corpdevIntent || '',
        // Family Office
        discretion_type: formData.discretionType || '',
        // Independent Sponsor
        committed_equity_band: formData.committedEquityBand || '',
        equity_source: formData.equitySource || [],
        deployment_timing: formData.deploymentTiming || '',
        target_deal_size_min: targetDealSizeMin ? parseCurrency(targetDealSizeMin) : undefined,
        target_deal_size_max: targetDealSizeMax ? parseCurrency(targetDealSizeMax) : undefined,
        geographic_focus: geographicFocus ? [geographicFocus] : targetLocations || [],
        industry_expertise: industryExpertise ? [industryExpertise] : [],
        deal_structure_preference: dealStructurePreference || '',
        permanent_capital: formData.permanentCapital || false,
        operating_company_targets: formData.operatingCompanyTargets || [],
        flex_subXm_ebitda: formData.flexSubxmEbitda || false,
        // Search Fund
        search_type: formData.searchType || '',
        acq_equity_band: formData.acqEquityBand || '',
        financing_plan: formData.financingPlan || [],
        search_stage: formData.searchStage || '',
        flex_sub2m_ebitda: formData.flexSub2mEbitda || false,
        // Advisor/Banker
        on_behalf_of_buyer: formData.onBehalfOfBuyer || '',
        buyer_role: formData.buyerRole || '',
        // Business Owner
        owner_timeline: formData.ownerTimeline || '',
        owner_intent: formData.ownerIntent || '',
        // Individual Investor
        uses_bank_finance: formData.usesBank || '',
        max_equity_today_band: formData.maxEquityToday || '',
        // Additional fields from comprehensive form
        mandate_blurb: formData.mandateBlurb || '',
        portfolio_company_addon: formData.portfolioCompanyAddon || '',
        backers_summary: formData.backersSummary || '',
        anchor_investors_summary: formData.anchorInvestorsSummary || '',
      };
      
      await signup(signupData, formData.password);
      
      // Show success toast
      toast({
        title: "Account created successfully!",
        description: "Please check your email to verify your account.",
      });
      
      // Navigate to static success page with email parameter
      navigate(`/signup-success?email=${encodeURIComponent(formData.email)}`);
      
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // More specific error handling
      let errorMessage = "An unexpected error occurred. Please try again.";
      
      if (error.message?.includes('User already registered')) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
      } else if (error.message?.includes('Password')) {
        errorMessage = "Password requirements not met. Please ensure it's at least 6 characters.";
      } else if (error.message?.includes('Email')) {
        errorMessage = "Invalid email address. Please check and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
               <Label htmlFor="email">Work Email</Label>
               <p className="text-xs text-muted-foreground">Please provide your work email address</p>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
            </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                />
                <div className="text-right text-xs">
                  <Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
                </div>
              </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                name="company"
                placeholder="Acme Inc."
                value={formData.company}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                placeholder="(123) 456-7890"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
               <Label htmlFor="jobTitle">Job Title <span className="text-xs text-muted-foreground">(optional)</span></Label>
               <Input
                 id="jobTitle"
                 name="jobTitle"
                 placeholder="e.g., Partner, VP Business Development, Investment Associate"
                value={formData.jobTitle || ""}
                onChange={handleInputChange}
              />
            </div>

            <Separator className="my-6" />
            <div className="text-sm text-muted-foreground mb-4">
              <strong>Professional Profile (Strongly encouraged)</strong>
              <p className="text-xs mt-1">
                Owners tell us this is extremely important in helping them see how their business aligns with your unique investment criteria.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                placeholder="https://www.example.com"
                value={formData.website}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedinProfile">LinkedIn Profile</Label>
              <Input
                id="linkedinProfile"
                name="linkedinProfile"
                placeholder="https://linkedin.com/in/yourprofile"
                value={formData.linkedinProfile}
                onChange={handleInputChange}
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="buyerType">Type of Buyer</Label>
              <Select
                onValueChange={handleBuyerTypeChange}
                value={formData.buyerType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select buyer type" />
                </SelectTrigger>
                <SelectContent>
                  {buyerTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="space-y-1">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Conditional fields based on buyer type */}
            {formData.buyerType === "corporate" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="estimatedRevenue">Estimated Revenue</Label>
                  <Select
                    value={formData.estimatedRevenue}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, estimatedRevenue: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select revenue range" />
                    </SelectTrigger>
                    <SelectContent>
                      {REVENUE_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="owningBusinessUnit">Owning business unit / brand <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <p className="text-xs text-muted-foreground">Which business unit or brand would this acquisition fall under?</p>
                  <Input
                    id="owningBusinessUnit"
                    name="owningBusinessUnit"
                    placeholder="e.g., Digital Services Division"
                    value={formData.owningBusinessUnit || ""}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dealSizeBand">Deal size (EV) <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-muted-foreground">Enterprise value range you're targeting</p>
                  <Select
                    value={formData.dealSizeBand || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, dealSizeBand: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select deal size range" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_SIZE_BAND_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Integration plan <span className="text-xs text-muted-foreground">(optional - select all that apply)</span></Label>
                  <p className="text-xs text-muted-foreground">How would you integrate this acquisition?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {INTEGRATION_PLAN_OPTIONS.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`integration-${option.value}`}
                          checked={(formData.integrationPlan || []).includes(option.value)}
                          onCheckedChange={(checked) => {
                            const current = formData.integrationPlan || [];
                            const updated = checked 
                              ? [...current, option.value]
                              : current.filter(item => item !== option.value);
                            setFormData(prev => ({ ...prev, integrationPlan: updated }));
                          }}
                        />
                        <Label htmlFor={`integration-${option.value}`} className="text-xs">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="corpdevIntent">Speed/intent <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <p className="text-xs text-muted-foreground">Current acquisition timeline and urgency</p>
                  <Select
                    value={formData.corpdevIntent || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, corpdevIntent: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your current approach" />
                    </SelectTrigger>
                    <SelectContent>
                      {CORPDEV_INTENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {formData.buyerType === "privateEquity" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fundSize">Fund Size</Label>
                  <Select
                    value={formData.fundSize}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, fundSize: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fund size" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUND_AUM_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="investmentSize">{FIELD_HELPERS.investmentSize.label}</Label>
                  <p className="text-xs text-muted-foreground">
                    {FIELD_HELPERS.investmentSize.description}
                  </p>
                  <Select
                    value={formData.investmentSize}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, investmentSize: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={FIELD_HELPERS.investmentSize.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aum">Assets Under Management</Label>
                  <Select
                    value={formData.aum}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, aum: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select AUM range" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUND_AUM_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="portfolioCompanyAddon">Which portfolio company would this be an add-on to (if any)? <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <p className="text-xs text-muted-foreground">Name the existing portfolio company for potential add-on acquisitions</p>
                  <Input
                    id="portfolioCompanyAddon"
                    name="portfolioCompanyAddon"
                    placeholder="e.g., ABC Manufacturing Co."
                    value={formData.portfolioCompanyAddon || ""}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="deployingCapitalNow">Deploying capital now? <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-muted-foreground">Current capital deployment status</p>
                  <Select
                    value={formData.deployingCapitalNow || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, deployingCapitalNow: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select deployment status" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPLOYING_CAPITAL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {formData.buyerType === "familyOffice" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fundSize">Fund Size</Label>
                  <Select
                    value={formData.fundSize}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, fundSize: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fund size" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUND_AUM_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="investmentSize">{FIELD_HELPERS.investmentSize.label}</Label>
                  <p className="text-xs text-muted-foreground">
                    {FIELD_HELPERS.investmentSize.description}
                  </p>
                  <Select
                    value={formData.investmentSize}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, investmentSize: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={FIELD_HELPERS.investmentSize.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aum">Assets Under Management</Label>
                  <Select
                    value={formData.aum}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, aum: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select AUM range" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUND_AUM_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="discretionType">Decision authority <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-muted-foreground">Your decision-making authority level</p>
                  <Select
                    value={formData.discretionType || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, discretionType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select authority type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISCRETION_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="permanentCapital"
                      checked={formData.permanentCapital || false}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, permanentCapital: checked as boolean }))}
                    />
                    <Label htmlFor="permanentCapital" className="text-sm">
                      Permanent capital <span className="text-xs text-muted-foreground">(optional)</span>
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">Check if you have permanent capital available</p>
                </div>
                
                <div className="space-y-2">
                  <Label>If you have an operating company this would add onto, name it <span className="text-xs text-muted-foreground">(optional - max 3)</span></Label>
                  <p className="text-xs text-muted-foreground">List operating companies for potential add-on opportunities</p>
                  <Input
                    placeholder="Enter company names, separated by commas"
                    value={(formData.operatingCompanyTargets || []).join(', ')}
                    onChange={(e) => {
                      const companies = e.target.value.split(',').map(s => s.trim()).filter(s => s).slice(0, 3);
                      setFormData(prev => ({ ...prev, operatingCompanyTargets: companies }));
                    }}
                  />
                </div>
              </div>
            )}
            
            {formData.buyerType === "searchFund" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="searchType">Search type <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-muted-foreground">Type of search fund structure</p>
                  <Select
                    value={formData.searchType || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, searchType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select search type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEARCH_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="acqEquityBand">Equity available for the acquisition at close <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-muted-foreground">Amount of equity capital you can deploy at closing</p>
                  <Select
                    value={formData.acqEquityBand || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, acqEquityBand: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select equity amount" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACQ_EQUITY_BAND_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Financing plan (select all that apply) <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-muted-foreground">Choose all financing sources you plan to use</p>
                  <div className="grid grid-cols-2 gap-2">
                    {FINANCING_PLAN_OPTIONS.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`financing-${option.value}`}
                          checked={(formData.financingPlan || []).includes(option.value)}
                          onCheckedChange={(checked) => {
                            const current = formData.financingPlan || [];
                            const updated = checked 
                              ? [...current, option.value]
                              : current.filter(item => item !== option.value);
                            setFormData(prev => ({ ...prev, financingPlan: updated }));
                          }}
                        />
                        <Label htmlFor={`financing-${option.value}`} className="text-xs">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="flexSub2mEbitda"
                      checked={formData.flexSub2mEbitda || false}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, flexSub2mEbitda: checked as boolean }))}
                    />
                    <Label htmlFor="flexSub2mEbitda" className="text-sm">
                      Flexible on size? (can pursue &lt; $2M EBITDA) <span className="text-red-500">*</span>
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">Check if willing to consider smaller deals below $2M EBITDA</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="anchorInvestorsSummary">Anchor investors / committed backers (one line, optional)</Label>
                  <p className="text-xs text-muted-foreground">List your committed investors or backers</p>
                  <Input
                    id="anchorInvestorsSummary"
                    name="anchorInvestorsSummary"
                    placeholder="e.g., XYZ Capital; ABC Family Office"
                    value={formData.anchorInvestorsSummary || ""}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="searchStage">Stage of search <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <p className="text-xs text-muted-foreground">Current stage of your search process</p>
                  <Select
                    value={formData.searchStage || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, searchStage: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select search stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEARCH_STAGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {formData.buyerType === "individual" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fundingSource">Funding source <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-muted-foreground">Primary source of acquisition funding</p>
                  <Select
                    value={formData.fundingSource}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, fundingSource: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select funding source" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIVIDUAL_FUNDING_SOURCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="usesBank">Will you use SBA/bank financing? <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-muted-foreground">Planning to use debt financing for acquisition</p>
                  <Select
                    value={formData.usesBank || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, usesBank: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      {USES_BANK_FINANCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxEquityToday">Max equity you can commit today <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <p className="text-xs text-muted-foreground">Maximum equity investment you can make today</p>
                  <Select
                    value={formData.maxEquityToday || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, maxEquityToday: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select equity range" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAX_EQUITY_TODAY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {formData.buyerType === "independentSponsor" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="committedEquityBand">Committed equity available today <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-muted-foreground">Amount of equity capital you have committed and available now</p>
                  <Select
                    value={formData.committedEquityBand || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, committedEquityBand: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select equity amount" />
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
                  <Label>Source of equity <span className="text-red-500">* (select all that apply)</span></Label>
                  <p className="text-xs text-muted-foreground">Choose all sources of your equity capital</p>
                  <div className="grid grid-cols-2 gap-2">
                    {EQUITY_SOURCE_OPTIONS.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`equity-source-${option.value}`}
                          checked={(formData.equitySource || []).includes(option.value)}
                          onCheckedChange={(checked) => {
                            const current = formData.equitySource || [];
                            const updated = checked 
                              ? [...current, option.value]
                              : current.filter(item => item !== option.value);
                            setFormData(prev => ({ ...prev, equitySource: updated }));
                          }}
                        />
                        <Label htmlFor={`equity-source-${option.value}`} className="text-xs">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="flexSubxmEbitda"
                      checked={formData.flexSubxmEbitda || false}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, flexSubxmEbitda: checked as boolean }))}
                    />
                    <Label htmlFor="flexSubxmEbitda" className="text-sm">
                      Flexible on size? <span className="text-red-500">*</span>
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">Check if willing to consider smaller deals below typical thresholds</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="backersSummary">Representative backers (one line) <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <p className="text-xs text-muted-foreground">List your key backers or funding sources</p>
                  <Input
                    id="backersSummary"
                    name="backersSummary"
                    placeholder="e.g., Smith Capital; Oak Family Office"
                    value={formData.backersSummary || ""}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="deploymentTiming">Readiness window <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <p className="text-xs text-muted-foreground">Timeline for deploying capital</p>
                  <Select
                    value={formData.deploymentTiming || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, deploymentTiming: value }))}
                  >
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
              </div>
            )}
            
            {formData.buyerType === "advisor" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="onBehalfOfBuyer">Are you inquiring on behalf of a capitalized buyer with discretion? <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-muted-foreground">Representing a buyer with committed capital and decision authority</p>
                  <Select
                    value={formData.onBehalfOfBuyer || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, onBehalfOfBuyer: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      {ON_BEHALF_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.onBehalfOfBuyer === "yes" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="buyerRole">Buyer role <span className="text-red-500">*</span></Label>
                      <p className="text-xs text-muted-foreground">Type of buyer you're representing</p>
                      <Select
                        value={formData.buyerRole || ""}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, buyerRole: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select buyer type" />
                        </SelectTrigger>
                        <SelectContent>
                          {BUYER_ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="buyerOrgUrl">Buyer organization website <span className="text-red-500">*</span></Label>
                      <p className="text-xs text-muted-foreground">Website of the organization you're representing</p>
                      <Input
                        id="buyerOrgUrl"
                        name="buyerOrgUrl"
                        type="url"
                        placeholder="https://www.buyercompany.com"
                        value={formData.buyerOrgUrl || ""}
                        onChange={handleInputChange}
                      />
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="mandateBlurb">Mandate in one line (≤140 chars) <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <p className="text-xs text-muted-foreground">Brief description of your client's acquisition mandate</p>
                  <Input
                    id="mandateBlurb"
                    name="mandateBlurb"
                    placeholder="e.g., Lower middle market tech services add-ons for PE portfolio"
                    maxLength={140}
                    value={formData.mandateBlurb || ""}
                    onChange={handleInputChange}
                  />
                  <p className="text-xs text-muted-foreground">{(formData.mandateBlurb || "").length}/140 characters</p>
                </div>
              </div>
            )}
            
            {formData.buyerType === "businessOwner" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ownerIntent">Why are you here? (≤140 chars) <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-muted-foreground">Brief description of your purpose (e.g., "Valuation", "Open to intros")</p>
                  <Input
                    id="ownerIntent"
                    name="ownerIntent"
                    placeholder='e.g., "Valuation", "Open to intros"'
                    maxLength={140}
                    value={formData.ownerIntent || ""}
                    onChange={handleInputChange}
                  />
                  <p className="text-xs text-muted-foreground">{(formData.ownerIntent || "").length}/140 characters</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ownerTimeline">Timeline <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <p className="text-xs text-muted-foreground">Expected timeline for any potential transaction</p>
                  <Select
                    value={formData.ownerTimeline || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, ownerTimeline: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timeline" />
                    </SelectTrigger>
                    <SelectContent>
                      {OWNER_TIMELINE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Let's build your buyer profile</h3>
              <p className="text-sm text-muted-foreground">
                This helps us understand what type of targets you're looking for and show you hand-picked deals that align with your criteria.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="idealTargetDescription">
                {FIELD_HELPERS.idealTargetDescription.label}
              </Label>
              <p className="text-xs text-muted-foreground">
                {FIELD_HELPERS.idealTargetDescription.description}
              </p>
              <Textarea
                id="idealTargetDescription"
                name="idealTargetDescription"
                placeholder={FIELD_HELPERS.idealTargetDescription.placeholder}
                rows={3}
                value={formData.idealTargetDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, idealTargetDescription: e.target.value }))}
              />
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">
                {FIELD_HELPERS.businessCategories.label}
              </Label>
              <p className="text-xs text-muted-foreground">
                {FIELD_HELPERS.businessCategories.description}
              </p>
              <EnhancedMultiCategorySelect
                value={formData.businessCategories}
                onValueChange={(selected) => setFormData(prev => ({ ...prev, businessCategories: selected }))}
                placeholder={FIELD_HELPERS.businessCategories.placeholder}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetLocations">
                {FIELD_HELPERS.targetLocations.label}
              </Label>
              <p className="text-xs text-muted-foreground">
                {FIELD_HELPERS.targetLocations.description}
              </p>
              <EnhancedMultiLocationSelect
                value={Array.isArray(formData.targetLocations) ? formData.targetLocations : []}
                onValueChange={(selected) => setFormData(prev => ({ ...prev, targetLocations: selected }))}
                placeholder={FIELD_HELPERS.targetLocations.placeholder}
                className="w-full"
              />
            </div>

            {/* Independent sponsor deal size ranges */}
            {formData.buyerType === "independentSponsor" && (
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  {FIELD_HELPERS.targetDealSize.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {FIELD_HELPERS.targetDealSize.description}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="targetDealSizeMin">{FIELD_HELPERS.targetDealSize.minLabel}</Label>
                    <Select
                      value={formData.targetDealSizeMin}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, targetDealSizeMin: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select minimum" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEAL_SIZE_RANGES.map((range) => (
                          <SelectItem key={range.value} value={range.value}>
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetDealSizeMax">{FIELD_HELPERS.targetDealSize.maxLabel}</Label>
                    <Select
                      value={formData.targetDealSizeMax}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, targetDealSizeMax: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select maximum" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEAL_SIZE_RANGES.map((range) => (
                          <SelectItem key={range.value} value={range.value}>
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Only show revenue range if buyer type is not Private Equity or Independent Sponsor */}
            {formData.buyerType !== "privateEquity" && formData.buyerType !== "independentSponsor" && (
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  {FIELD_HELPERS.revenueRange.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {FIELD_HELPERS.revenueRange.description}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="revenueRangeMin">{FIELD_HELPERS.revenueRange.minLabel}</Label>
                    <Select
                      value={formData.revenueRangeMin}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, revenueRangeMin: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select minimum" />
                      </SelectTrigger>
                      <SelectContent>
                        {REVENUE_RANGES.map((range) => (
                          <SelectItem key={range.value} value={range.value}>
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revenueRangeMax">{FIELD_HELPERS.revenueRange.maxLabel}</Label>
                    <Select
                      value={formData.revenueRangeMax}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, revenueRangeMax: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select maximum" />
                      </SelectTrigger>
                      <SelectContent>
                        {REVENUE_RANGES.map((range) => (
                          <SelectItem key={range.value} value={range.value}>
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="specificBusinessSearch">
                {FIELD_HELPERS.specificBusinessSearch.label}
              </Label>
              <p className="text-xs text-muted-foreground">
                {FIELD_HELPERS.specificBusinessSearch.description}
              </p>
              <Textarea
                id="specificBusinessSearch"
                name="specificBusinessSearch"
                placeholder={FIELD_HELPERS.specificBusinessSearch.placeholder}
                rows={3}
                value={formData.specificBusinessSearch}
                onChange={(e) => setFormData(prev => ({ ...prev, specificBusinessSearch: e.target.value }))}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 min-h-screen items-center max-w-7xl mx-auto">
          
          {/* Left Column - Signup Form */}
          <div className="flex flex-col justify-center space-y-8">
            {/* Brand Header */}
            <div className="flex items-center space-x-3 mb-2">
              <img 
                src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
                alt="SourceCo Logo" 
                className="h-8 w-8"
              />
              <div>
                <h1 className="text-xl font-semibold tracking-tight">SourceCo</h1>
                <p className="text-sm text-muted-foreground font-light">Marketplace</p>
              </div>
            </div>

            <Card className="border-none shadow-lg">
              <CardHeader className="space-y-2 pb-6">
                <CardTitle className="text-xl font-semibold">
                  Create your account
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Step {currentStep + 1} of {steps.length}: {steps[currentStep]}
                </CardDescription>
                
                {/* Progress bar */}
                <div className="w-full bg-muted h-1 rounded-full mt-3">
                  <div
                    className="bg-primary h-1 rounded-full transition-all duration-300"
                    style={{
                      width: `${((currentStep + 1) / steps.length) * 100}%`,
                    }}
                  />
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {validationErrors.length > 0 && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg">
                    <ul className="list-disc pl-4 space-y-1 text-xs">
                      {validationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-5">
                  {renderStepContent()}
                </form>
              </CardContent>
              
              <CardFooter className="flex flex-col space-y-4 pt-6">
                <div className="flex justify-between w-full">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={currentStep === 0 || isLoading || isSubmitting}
                    className="text-xs"
                  >
                    Back
                  </Button>
                  
                  {currentStep === steps.length - 1 ? (
                    <Button
                      type="submit"
                      onClick={handleSubmit}
                      disabled={isLoading || isSubmitting}
                      size="sm"
                      className="text-xs font-medium"
                    >
                      {isLoading || isSubmitting ? "Creating account..." : "Create account"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={isLoading || isSubmitting}
                      size="sm"
                      className="text-xs font-medium"
                    >
                      Continue
                    </Button>
                  )}
                </div>
                
                <div className="text-xs text-center text-muted-foreground">
                  <span>Already have an account? </span>
                  <Link
                    to="/login"
                    className="text-primary font-medium hover:underline transition-colors"
                  >
                    Sign in
                  </Link>
                </div>
              </CardFooter>
            </Card>
          </div>

          {/* Right Column - Why SourceCo */}
          <div className="hidden lg:flex flex-col justify-center space-y-8 pl-8">
            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Why SourceCo?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                  Stop wasting time on unqualified opportunities. Access pre-vetted businesses 
                  with verified financials and motivated sellers ready to transact.
                </p>
              </div>

              <Card className="bg-gradient-to-br from-muted/30 to-muted/10 border border-border/50 shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      <img 
                        src="/lovable-uploads/252f5573-94e8-40ff-a88d-685794544b28.png" 
                        alt="Mellisa Berry"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-2">
                      <blockquote className="text-sm text-foreground leading-relaxed italic">
                        "We sourced three acquisitions through SourceCo in six months—deals we 
                        never would have found through traditional channels. The quality of opportunities 
                        and direct seller access changed our entire sourcing strategy."
                      </blockquote>
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-foreground">
                          Mellisa Berry
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Partner, <a 
                            href="https://www.newheritagecapital.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline transition-all duration-200"
                          >
                            New Heritage Capital
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-4 text-xs text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  <span>Break free from broker gatekeepers</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  <span>Connect directly with motivated sellers</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  <span>Transform reactive to proactive sourcing</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Signup;
