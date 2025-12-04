import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { z } from "zod/v3";
import bradDaughertyImage from '@/assets/brad-daugherty.png';
import sfcLogo from '@/assets/sfc-logo.png';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BuyerType, User } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChipInput } from "@/components/ui/chip-input";
import { parseCurrency } from "@/lib/currency-utils";
import { processUrl, isValidUrlFormat, isValidLinkedInFormat, processLinkedInUrl } from "@/lib/url-utils";
import { StepIndicator } from "@/components/ui/step-indicator";
import { ArrowLeft } from "lucide-react";

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
import { EnhancedCurrencyInput } from "@/components/ui/enhanced-currency-input";
import { FIELD_HELPERS } from "@/lib/field-helpers";
import { REVENUE_RANGES, FUND_AUM_RANGES, INVESTMENT_RANGES, DEAL_SIZE_RANGES } from "@/lib/currency-ranges";
import { InvestmentSizeSelect } from "@/components/ui/investment-size-select";
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
  MAX_EQUITY_TODAY_OPTIONS,
  DEAL_INTENT_OPTIONS
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
    investmentSize: string[];
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
    // New Step 4 fields
    dealIntent?: string;
    exclusions?: string[];
    includeKeywords?: string[];
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
    investmentSize: [],
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
    // New Step 4 fields
    dealIntent: "",
    exclusions: [],
    includeKeywords: [],
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
      investmentSize: [] as string[],
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
        if (formData.website && !isValidUrlFormat(formData.website)) {
          errors.push("Please enter a valid website URL (e.g., example.com or www.example.com)");
        }
        // LinkedIn validation - optional but validate format if provided
        if (formData.linkedinProfile && !isValidLinkedInFormat(formData.linkedinProfile)) {
          errors.push("Please enter a valid LinkedIn URL (e.g., linkedin.com/in/yourname)");
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
              } else if (!isValidUrlFormat(formData.buyerOrgUrl)) {
                errors.push("Please enter a valid buyer organization website (e.g., company.com)");
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
        website: processUrl(website),
        linkedin_profile: processLinkedInUrl(linkedinProfile),
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
        investment_size: investmentSize || [],
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
        buyer_org_url: formData.buyerOrgUrl ? processUrl(formData.buyerOrgUrl) : '',
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
        flex_subxm_ebitda: formData.flexSubxmEbitda || false,
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
        // New Step 4 fields
        deal_intent: formData.dealIntent || '',
        exclusions: formData.exclusions || [],
        include_keywords: formData.includeKeywords || [],
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
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
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
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
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
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs text-muted-foreground">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-xs text-muted-foreground">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-xs text-muted-foreground">Last Name</Label>
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
            <div className="space-y-1.5">
              <Label htmlFor="company" className="text-xs text-muted-foreground">Company</Label>
              <Input
                id="company"
                name="company"
                placeholder="Acme Inc."
                value={formData.company}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phoneNumber" className="text-xs text-muted-foreground">Phone</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  placeholder="(123) 456-7890"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jobTitle" className="text-xs text-muted-foreground">Job Title</Label>
                <Input
                  id="jobTitle"
                  name="jobTitle"
                  placeholder="e.g., Partner, VP"
                  value={formData.jobTitle || ""}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="website" className="text-xs text-muted-foreground">Website</Label>
                <Input
                  id="website"
                  name="website"
                  placeholder="example.com"
                  value={formData.website}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="linkedinProfile" className="text-xs text-muted-foreground">LinkedIn</Label>
                <Input
                  id="linkedinProfile"
                  name="linkedinProfile"
                  placeholder="linkedin.com/in/..."
                  value={formData.linkedinProfile}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="buyerType" className="text-xs text-muted-foreground">Type of Buyer</Label>
              <Select
                onValueChange={handleBuyerTypeChange}
                value={formData.buyerType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {buyerTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Conditional fields based on buyer type */}
            {formData.buyerType === "corporate" && (
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="estimatedRevenue" className="text-xs text-muted-foreground">Estimated Revenue</Label>
                  <EnhancedCurrencyInput
                    value={formData.estimatedRevenue}
                    onChange={(value) => setFormData((prev) => ({ ...prev, estimatedRevenue: value }))}
                    fieldType="revenue"
                    currencyMode="millions"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="owningBusinessUnit" className="text-xs text-muted-foreground">Business Unit</Label>
                  <Input
                    id="owningBusinessUnit"
                    name="owningBusinessUnit"
                    placeholder="e.g., Digital Services Division"
                    value={formData.owningBusinessUnit || ""}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="dealSizeBand" className="text-xs text-muted-foreground">Deal Size (EV)</Label>
                  <Select
                    value={formData.dealSizeBand || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, dealSizeBand: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Integration Plan</Label>
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
                        <Label htmlFor={`integration-${option.value}`} className="text-xs font-normal">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="corpdevIntent" className="text-xs text-muted-foreground">Speed/Intent</Label>
                  <Select
                    value={formData.corpdevIntent || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, corpdevIntent: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
                <div className="space-y-1.5">
                  <Label htmlFor="fundSize" className="text-xs text-muted-foreground">Fund Size</Label>
                  <EnhancedCurrencyInput
                    value={formData.fundSize}
                    onChange={(value) => setFormData((prev) => ({ ...prev, fundSize: value }))}
                    fieldType="fund"
                    currencyMode="millions"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="investmentSize" className="text-xs text-muted-foreground">{FIELD_HELPERS.investmentSize.label}</Label>
                  <InvestmentSizeSelect
                    value={formData.investmentSize}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, investmentSize: value }))}
                    placeholder="Select investment size ranges..."
                    multiSelect={true}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aum" className="text-xs text-muted-foreground">Assets Under Management</Label>
                  <EnhancedCurrencyInput
                    value={formData.aum}
                    onChange={(value) => setFormData((prev) => ({ ...prev, aum: value }))}
                    fieldType="aum"
                    currencyMode="millions"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="portfolioCompanyAddon" className="text-xs text-muted-foreground">Portfolio company add-on</Label>
                  <Input
                    id="portfolioCompanyAddon"
                    name="portfolioCompanyAddon"
                    placeholder="e.g., ABC Manufacturing Co."
                    value={formData.portfolioCompanyAddon || ""}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="deployingCapitalNow" className="text-xs text-muted-foreground">Deploying capital now?</Label>
                  <Select
                    value={formData.deployingCapitalNow || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, deployingCapitalNow: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
                <div className="space-y-1.5">
                  <Label htmlFor="fundSize" className="text-xs text-muted-foreground">Fund Size</Label>
                  <EnhancedCurrencyInput
                    value={formData.fundSize}
                    onChange={(value) => setFormData((prev) => ({ ...prev, fundSize: value }))}
                    fieldType="fund"
                    currencyMode="millions"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="investmentSize" className="text-xs text-muted-foreground">{FIELD_HELPERS.investmentSize.label}</Label>
                  <InvestmentSizeSelect
                    value={formData.investmentSize}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, investmentSize: value }))}
                    placeholder="Select investment size ranges..."
                    multiSelect={true}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aum" className="text-xs text-muted-foreground">Assets Under Management</Label>
                  <EnhancedCurrencyInput
                    value={formData.aum}
                    onChange={(value) => setFormData((prev) => ({ ...prev, aum: value }))}
                    fieldType="aum"
                    currencyMode="millions"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="discretionType" className="text-xs text-muted-foreground">Decision authority</Label>
                  <Select
                    value={formData.discretionType || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, discretionType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="permanentCapital"
                    checked={formData.permanentCapital || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, permanentCapital: checked as boolean }))}
                  />
                  <Label htmlFor="permanentCapital" className="text-xs font-normal">
                    Permanent capital
                  </Label>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Operating company add-ons</Label>
                  <ChipInput
                    value={formData.operatingCompanyTargets || []}
                    onChange={(companies) => setFormData(prev => ({ ...prev, operatingCompanyTargets: companies.slice(0, 3) }))}
                    placeholder="Enter company name and press Enter"
                  />
                </div>
              </div>
            )}
            
            {formData.buyerType === "searchFund" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="searchType" className="text-xs text-muted-foreground">Search type</Label>
                  <Select
                    value={formData.searchType || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, searchType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
                
                <div className="space-y-1.5">
                  <Label htmlFor="acqEquityBand" className="text-xs text-muted-foreground">Equity available at close</Label>
                  <Select
                    value={formData.acqEquityBand || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, acqEquityBand: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Financing plan</Label>
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
                        <Label htmlFor={`financing-${option.value}`} className="text-xs font-normal">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="flexSub2mEbitda"
                    checked={formData.flexSub2mEbitda || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, flexSub2mEbitda: checked as boolean }))}
                  />
                  <Label htmlFor="flexSub2mEbitda" className="text-xs font-normal">
                    Flexible on size? (can pursue &lt; $2M EBITDA)
                  </Label>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="anchorInvestorsSummary" className="text-xs text-muted-foreground">Anchor investors / backers</Label>
                  <Input
                    id="anchorInvestorsSummary"
                    name="anchorInvestorsSummary"
                    placeholder="e.g., XYZ Capital; ABC Family Office"
                    value={formData.anchorInvestorsSummary || ""}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="searchStage" className="text-xs text-muted-foreground">Stage of search</Label>
                  <Select
                    value={formData.searchStage || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, searchStage: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
                <div className="space-y-1.5">
                  <Label htmlFor="fundingSource" className="text-xs text-muted-foreground">Funding source</Label>
                  <Select
                    value={formData.fundingSource}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, fundingSource: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select..." />
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
                
                <div className="space-y-1.5">
                  <Label htmlFor="usesBank" className="text-xs text-muted-foreground">Will you use SBA/bank financing?</Label>
                  <Select
                    value={formData.usesBank || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, usesBank: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select..." />
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
                
                <div className="space-y-1.5">
                  <Label htmlFor="maxEquityToday" className="text-xs text-muted-foreground">Max equity you can commit today</Label>
                  <Select
                    value={formData.maxEquityToday || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, maxEquityToday: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
                <div className="space-y-1.5">
                  <Label htmlFor="committedEquityBand" className="text-xs text-muted-foreground">Committed equity available</Label>
                  <Select
                    value={formData.committedEquityBand || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, committedEquityBand: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Source of equity</Label>
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
                        <Label htmlFor={`equity-source-${option.value}`} className="text-xs font-normal">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="flexSubxmEbitda"
                    checked={formData.flexSubxmEbitda || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, flexSubxmEbitda: checked as boolean }))}
                  />
                  <Label htmlFor="flexSubxmEbitda" className="text-xs font-normal">
                    Flexible on size?
                  </Label>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="backersSummary" className="text-xs text-muted-foreground">Representative backers</Label>
                  <Input
                    id="backersSummary"
                    name="backersSummary"
                    placeholder="e.g., Smith Capital; Oak Family Office"
                    value={formData.backersSummary || ""}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="deploymentTiming" className="text-xs text-muted-foreground">Readiness window</Label>
                  <Select
                    value={formData.deploymentTiming || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, deploymentTiming: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
                <div className="space-y-1.5">
                  <Label htmlFor="onBehalfOfBuyer" className="text-xs text-muted-foreground">Inquiring on behalf of a capitalized buyer?</Label>
                  <Select
                    value={formData.onBehalfOfBuyer || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, onBehalfOfBuyer: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
                    <div className="space-y-1.5">
                      <Label htmlFor="buyerRole" className="text-xs text-muted-foreground">Buyer role</Label>
                      <Select
                        value={formData.buyerRole || ""}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, buyerRole: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
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
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="buyerOrgUrl" className="text-xs text-muted-foreground">Buyer organization website</Label>
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
                
                <div className="space-y-1.5">
                  <Label htmlFor="mandateBlurb" className="text-xs text-muted-foreground">Mandate in one line (≤140 chars)</Label>
                  <Input
                    id="mandateBlurb"
                    name="mandateBlurb"
                    placeholder="e.g., Lower middle market tech services add-ons for PE portfolio"
                    maxLength={140}
                    value={formData.mandateBlurb || ""}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            )}
            
            {formData.buyerType === "businessOwner" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ownerIntent" className="text-xs text-muted-foreground">Why are you here? (≤140 chars)</Label>
                  <Input
                    id="ownerIntent"
                    name="ownerIntent"
                    placeholder='e.g., "Valuation", "Open to intros"'
                    maxLength={140}
                    value={formData.ownerIntent || ""}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="ownerTimeline" className="text-xs text-muted-foreground">Timeline</Label>
                  <Select
                    value={formData.ownerTimeline || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, ownerTimeline: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="idealTargetDescription" className="text-xs text-muted-foreground">
                {FIELD_HELPERS.idealTargetDescription.label}
              </Label>
              <Textarea
                id="idealTargetDescription"
                name="idealTargetDescription"
                placeholder={FIELD_HELPERS.idealTargetDescription.placeholder}
                rows={3}
                value={formData.idealTargetDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, idealTargetDescription: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {FIELD_HELPERS.businessCategories.label}
              </Label>
              <EnhancedMultiCategorySelect
                value={formData.businessCategories}
                onValueChange={(selected) => setFormData(prev => ({ ...prev, businessCategories: selected }))}
                placeholder={FIELD_HELPERS.businessCategories.placeholder}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="targetLocations" className="text-xs text-muted-foreground">
                {FIELD_HELPERS.targetLocations.label}
              </Label>
              <EnhancedMultiLocationSelect
                value={Array.isArray(formData.targetLocations) ? formData.targetLocations : []}
                onValueChange={(selected) => setFormData(prev => ({ ...prev, targetLocations: selected }))}
                placeholder={FIELD_HELPERS.targetLocations.placeholder}
                className="w-full"
              />
            </div>

            {/* Independent sponsor deal size ranges */}
            {formData.buyerType === "independentSponsor" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {FIELD_HELPERS.targetDealSize.label}
                </Label>
                <Select
                  value={formData.targetDealSizeMin && formData.targetDealSizeMax 
                    ? `${formData.targetDealSizeMin}-${formData.targetDealSizeMax}`
                    : ""}
                  onValueChange={(value) => {
                    const range = DEAL_SIZE_RANGES.find(r => r.value === value);
                    if (range) {
                      const parts = range.value.split(' - ');
                      const min = parts[0]?.replace(/[^0-9]/g, '') || "";
                      const max = parts[1]?.replace(/[^0-9]/g, '') || "";
                      setFormData(prev => ({ 
                        ...prev, 
                        targetDealSizeMin: min ? `${min}000000` : "",
                        targetDealSizeMax: max ? `${max}000000` : ""
                      }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
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
            )}

            {/* Only show revenue range if buyer type is not Private Equity or Independent Sponsor */}
            {formData.buyerType !== "privateEquity" && formData.buyerType !== "independentSponsor" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {FIELD_HELPERS.revenueRange.label}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={formData.revenueRangeMin}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, revenueRangeMin: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {REVENUE_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={formData.revenueRangeMax}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, revenueRangeMax: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
            )}

            <div className="space-y-1.5">
              <Label htmlFor="specificBusinessSearch" className="text-xs text-muted-foreground">
                {FIELD_HELPERS.specificBusinessSearch.label}
              </Label>
              <Textarea
                id="specificBusinessSearch"
                name="specificBusinessSearch"
                placeholder={FIELD_HELPERS.specificBusinessSearch.placeholder}
                rows={3}
                value={formData.specificBusinessSearch}
                onChange={(e) => setFormData(prev => ({ ...prev, specificBusinessSearch: e.target.value }))}
              />
            </div>

            {/* Deal Intent */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {FIELD_HELPERS.dealIntent.label}
              </Label>
              <RadioGroup
                value={formData.dealIntent || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, dealIntent: value }))}
                className="space-y-1.5"
              >
                {DEAL_INTENT_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label htmlFor={option.value} className="font-normal cursor-pointer text-xs">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Hard Exclusions */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {FIELD_HELPERS.exclusions.label}
              </Label>
              <ChipInput
                value={formData.exclusions || []}
                onChange={(value) => setFormData(prev => ({ ...prev, exclusions: value }))}
                placeholder={FIELD_HELPERS.exclusions.placeholder}
                maxChips={20}
              />
            </div>

            {/* Include Keywords */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {FIELD_HELPERS.includeKeywords.label}
              </Label>
              <ChipInput
                value={formData.includeKeywords || []}
                onChange={(value) => setFormData(prev => ({ ...prev, includeKeywords: value }))}
                placeholder={FIELD_HELPERS.includeKeywords.placeholder}
                maxChips={5}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const rightContent = (
    <div className="space-y-8 pr-8">
      {/* Welcome Header */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Welcome to SourceCo
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Stop wasting time on unqualified opportunities. Access pre-vetted businesses 
          with verified financials and motivated sellers ready to transact.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Join our network of acquirers who source deals directly from owners, before 
          they go to brokers or public listings.
        </p>
      </div>

      {/* Testimonial */}
      <Card className="bg-background/80 border border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex-shrink-0">
              <img 
                src={bradDaughertyImage} 
                alt="Brad Daughterty"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-2 flex-1 relative">
              <blockquote className="text-xs text-foreground leading-relaxed italic">
                "SourceCo's technology-driven sourcing process consistently delivered a 
                robust pipeline of qualified opportunities, resulting in multiple LOIs and 
                a closed deal with more to come."
              </blockquote>
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-foreground">
                  Brad Daughterty
                </div>
                <div className="text-[11px] text-muted-foreground">
                  CFO, <a 
                    href="https://sportsfacilities.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Sports Facilities Companies
                  </a>
                </div>
              </div>
              <div className="absolute bottom-0 right-0">
                <img 
                  src={sfcLogo} 
                  alt="Sports Facilities Companies"
                  className="h-5 w-auto opacity-60"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Value Props */}
      <div className="space-y-2 text-xs text-muted-foreground">
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
  );

  return (
    <AuthLayout 
      rightContent={rightContent}
      showBackLink
      backLinkTo="/welcome"
      backLinkText="Back to selection"
    >
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="space-y-4 pb-6 px-0">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">
              Create your account
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              {steps[currentStep]}
            </CardDescription>
          </div>
          
          {/* Step Indicator */}
          <StepIndicator 
            currentStep={currentStep} 
            totalSteps={steps.length} 
          />
        </CardHeader>
        
        <CardContent className="px-0">
          {validationErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg mb-6">
              <ul className="list-disc pl-4 space-y-1 text-sm">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {renderStepContent()}
          </form>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4 pt-6 px-0">
          {/* Navigation buttons */}
          <div className="w-full space-y-3">
            {currentStep === steps.length - 1 ? (
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={isLoading || isSubmitting}
                className="w-full text-sm font-medium"
              >
                {isLoading || isSubmitting ? "Creating account..." : "Create account"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleNext}
                disabled={isLoading || isSubmitting}
                className="w-full text-sm font-medium"
              >
                Continue
              </Button>
            )}
            
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrevious}
                disabled={isLoading || isSubmitting}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to previous step
              </button>
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
    </AuthLayout>
  );
};

export default Signup;
