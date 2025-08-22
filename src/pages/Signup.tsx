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
import { MultiSelect } from "@/components/ui/multi-select";
import { MultiLocationSelect } from "@/components/ui/location-select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { parseCurrency } from "@/lib/currency-utils";

const steps = [
  "Account Information",
  "Personal Details", 
  "Buyer Type",
  "Buyer Profile",
];

import { STANDARDIZED_CATEGORIES } from "@/lib/financial-parser";
import { MultiCategorySelect } from "@/components/ui/category-select";

const buyerTypeOptions = [
  { value: "corporate", label: "Corporate", description: "Operating companies looking to acquire complementary businesses" },
  { value: "privateEquity", label: "Private Equity", description: "Professional investment firms managing institutional capital" },
  { value: "familyOffice", label: "Family Office", description: "Private wealth management entities making direct investments" },
  { value: "searchFund", label: "Search Fund", description: "Entrepreneurs seeking to acquire and operate a single company" },
  { value: "individual", label: "Individual", description: "Individual investors using personal capital or SBA financing" },
  { value: "independentSponsor", label: "Independent Sponsor", description: "Investment professionals sourcing deals without permanent capital" },
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
    geographicFocus: string[];
    industryExpertise: string[];
    dealStructurePreference: string;
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
    geographicFocus: [],
    industryExpertise: [],
    dealStructurePreference: "",
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
      geographicFocus: [],
      industryExpertise: [],
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
            break;
          case "privateEquity":
          case "familyOffice":
            if (!formData.fundSize) {
              errors.push("Fund size is required");
            }
            break;
          case "searchFund":
            if (!formData.isFunded) {
              errors.push("Please specify if you're funded");
            }
            break;
          case "individual":
            if (!formData.fundingSource) {
              errors.push("Funding source is required");
            }
            break;
           case "independentSponsor":
            if (!formData.investmentSize) {
              errors.push("Investment size is required");
            }
            if (!formData.dealStructurePreference) {
              errors.push("Deal structure preference is required");
            }
            if (!formData.geographicFocus || formData.geographicFocus.length < 10) {
              errors.push("Geographic focus description is required (minimum 10 characters)");
            }
            if (!formData.industryExpertise || formData.industryExpertise.length < 10) {
              errors.push("Industry expertise description is required (minimum 10 characters)");
            }
            break;
        }
        break;
      }
      case 3: {
        // Enhanced validation
        if (!formData.idealTargetDescription.trim() || formData.idealTargetDescription.length < 50) {
          errors.push("Please provide at least 50 characters describing your ideal targets");
        }
        // Business categories validation - at least 1 OR "All Industries"
        if (formData.businessCategories.length === 0 || 
            (formData.businessCategories.length === 1 && !formData.businessCategories.includes('All Industries') && formData.businessCategories.length < 2)) {
          errors.push("Please select at least 2 business categories, or choose 'All Industries'");
        }
        // Website and LinkedIn validation (required)
        if (!formData.website.trim()) {
          errors.push("Website is required");
        }
        if (!formData.linkedinProfile.trim()) {
          errors.push("LinkedIn profile is required");
        }
          if (formData.targetLocations.length === 0) {
          errors.push("Please select at least one target location");
        }
        if (formData.revenueRangeMin && formData.revenueRangeMax) {
          const min = parseCurrency(formData.revenueRangeMin);
          const max = parseCurrency(formData.revenueRangeMax);
          if (min >= max) {
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
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep()) return;
    
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
        revenue_range_min: revenueRangeMin ? parseFloat(revenueRangeMin.replace(/[^0-9.]/g, "")) : undefined,
        revenue_range_max: revenueRangeMax ? parseFloat(revenueRangeMax.replace(/[^0-9.]/g, "")) : undefined,
        specific_business_search: specificBusinessSearch,
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
        // Independent sponsor specific fields
        target_deal_size_min: targetDealSizeMin ? parseCurrency(targetDealSizeMin) : undefined,
        target_deal_size_max: targetDealSizeMax ? parseCurrency(targetDealSizeMax) : undefined,
        geographic_focus: geographicFocus,
        industry_expertise: industryExpertise,
        deal_structure_preference: dealStructurePreference,
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
              <Label htmlFor="email">Email</Label>
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

            <Separator className="my-6" />
            <div className="text-sm text-muted-foreground mb-4">
              <strong>Professional Profile (Required)</strong>
              <p className="text-xs mt-1">
                Owners require this information to evaluate your investment criteria and determine fit.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website *</Label>
              <Input
                id="website"
                name="website"
                placeholder="https://www.example.com"
                value={formData.website}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedinProfile">LinkedIn Profile *</Label>
              <Input
                id="linkedinProfile"
                name="linkedinProfile"
                placeholder="https://linkedin.com/in/yourprofile"
                value={formData.linkedinProfile}
                onChange={handleInputChange}
                required
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
              <div className="space-y-2">
                <Label htmlFor="estimatedRevenue">Estimated Revenue</Label>
                <CurrencyInput
                  id="estimatedRevenue"
                  name="estimatedRevenue"
                  placeholder="$1,000,000"
                  value={formData.estimatedRevenue}
                  onChange={(val) => setFormData((prev) => ({ ...prev, estimatedRevenue: val }))}
                  required
                />
              </div>
            )}
            
            {(formData.buyerType === "privateEquity" || formData.buyerType === "familyOffice") && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fundSize">Fund Size</Label>
                  <CurrencyInput
                    id="fundSize"
                    name="fundSize"
                    placeholder="$10,000,000"
                    value={formData.fundSize}
                    onChange={(val) => setFormData((prev) => ({ ...prev, fundSize: val }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="investmentSize">Investment Size</Label>
                  <Select
                    value={formData.investmentSize}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, investmentSize: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select investment size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Under $1M">Under $1M</SelectItem>
                      <SelectItem value="$1M - $5M">$1M - $5M</SelectItem>
                      <SelectItem value="$5M - $10M">$5M - $10M</SelectItem>
                      <SelectItem value="$10M - $25M">$10M - $25M</SelectItem>
                      <SelectItem value="Over $25M">Over $25M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aum">Assets Under Management</Label>
                  <CurrencyInput
                    id="aum"
                    name="aum"
                    placeholder="$100,000,000"
                    value={formData.aum}
                    onChange={(val) => setFormData((prev) => ({ ...prev, aum: val }))}
                  />
                </div>
              </div>
            )}
            
            {formData.buyerType === "searchFund" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="isFunded">Are you funded?</Label>
                  <Select
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        isFunded: value,
                      }))
                    }
                    value={formData.isFunded}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.isFunded === "yes" && (
                  <div className="space-y-2">
                    <Label htmlFor="fundedBy">Who is your funder?</Label>
                    <Input
                      id="fundedBy"
                      name="fundedBy"
                      placeholder="Investor name"
                      value={formData.fundedBy}
                      onChange={handleBuyerSpecificChange}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="targetCompanySize">Target Company Size</Label>
                  <Select
                    value={formData.targetCompanySize}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, targetCompanySize: value }))}
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
              </div>
            )}
            
            {formData.buyerType === "individual" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fundingSource">Funding Source</Label>
                  <Select
                    value={formData.fundingSource}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, fundingSource: value }))}
                  >
                    <SelectTrigger className="w-full">
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
                  <Label htmlFor="needsLoan">SBA/Bank loan?</Label>
                  <Select
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        needsLoan: value,
                      }))
                    }
                    value={formData.needsLoan}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idealTarget">Ideal Target</Label>
                  <Input
                    id="idealTarget"
                    name="idealTarget"
                    placeholder="Description of ideal acquisition"
                    value={formData.idealTarget}
                    onChange={handleBuyerSpecificChange}
                  />
                </div>
              </div>
            )}
            
            {formData.buyerType === "independentSponsor" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="investmentSize">Investment Size</Label>
                  <Select
                    value={formData.investmentSize}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, investmentSize: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select investment size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Under $1M">Under $1M</SelectItem>
                      <SelectItem value="$1M - $5M">$1M - $5M</SelectItem>
                      <SelectItem value="$5M - $10M">$5M - $10M</SelectItem>
                      <SelectItem value="$10M - $25M">$10M - $25M</SelectItem>
                      <SelectItem value="Over $25M">Over $25M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dealStructurePreference">Deal Structure Preference</Label>
                  <Select
                    value={formData.dealStructurePreference}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, dealStructurePreference: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select deal structure" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equity">Equity Purchase</SelectItem>
                      <SelectItem value="asset">Asset Purchase</SelectItem>
                      <SelectItem value="majority">Majority Stake</SelectItem>
                      <SelectItem value="minority">Minority Investment</SelectItem>
                      <SelectItem value="flexible">Flexible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="geographicFocus">Geographic Focus</Label>
                  <Textarea
                    id="geographicFocus"
                    name="geographicFocus"
                    placeholder="Describe your geographic focus and investment criteria (minimum 10 characters)..."
                    rows={2}
                    value={formData.geographicFocus.join(', ')}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      geographicFocus: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industryExpertise">Industry Expertise</Label>
                  <Textarea
                    id="industryExpertise"
                    name="industryExpertise"
                    placeholder="Describe your industry expertise and sector focus (minimum 10 characters)..."
                    rows={2}
                    value={formData.industryExpertise.join(', ')}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      industryExpertise: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                    }))}
                  />
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
                Please describe your ideal targets in 2-3 sentences
              </Label>
              <Textarea
                id="idealTargetDescription"
                name="idealTargetDescription"
                placeholder="I'm looking for profitable service businesses in the healthcare sector with stable customer bases and growth potential..."
                rows={3}
                value={formData.idealTargetDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, idealTargetDescription: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">
                What kind of businesses are you looking to buy?
              </Label>
              <MultiCategorySelect
                value={formData.businessCategories}
                onValueChange={(selected) => setFormData(prev => ({ ...prev, businessCategories: selected }))}
                placeholder="Select industries..."
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetLocations">
                What locations are you considering purchasing in?
              </Label>
              <MultiLocationSelect
                value={formData.targetLocations}
                onValueChange={(selected) => setFormData(prev => ({ ...prev, targetLocations: selected }))}
                placeholder="Select target locations..."
                className="w-full"
              />
            </div>

            {/* Independent sponsor deal size ranges */}
            {formData.buyerType === "independentSponsor" && (
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  What is your target deal size range?
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="targetDealSizeMin">$ Minimum Deal Size</Label>
                    <CurrencyInput
                      id="targetDealSizeMin"
                      name="targetDealSizeMin"
                      placeholder="1,000,000"
                      value={formData.targetDealSizeMin}
                      onChange={(val) => setFormData(prev => ({ ...prev, targetDealSizeMin: val }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetDealSizeMax">$ Maximum Deal Size</Label>
                    <CurrencyInput
                      id="targetDealSizeMax"
                      name="targetDealSizeMax"
                      placeholder="10,000,000"
                      value={formData.targetDealSizeMax}
                      onChange={(val) => setFormData(prev => ({ ...prev, targetDealSizeMax: val }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Only show revenue range if buyer type is not Private Equity or Independent Sponsor */}
            {formData.buyerType !== "privateEquity" && formData.buyerType !== "independentSponsor" && (
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  What is the revenue range you're looking for in a potential acquisition?
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="revenueRangeMin">$ Minimum</Label>
                    <CurrencyInput
                      id="revenueRangeMin"
                      name="revenueRangeMin"
                      placeholder="500,000"
                      value={formData.revenueRangeMin}
                      onChange={(val) => setFormData(prev => ({ ...prev, revenueRangeMin: val }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revenueRangeMax">$ Maximum</Label>
                    <CurrencyInput
                      id="revenueRangeMax"
                      name="revenueRangeMax"
                      placeholder="5,000,000"
                      value={formData.revenueRangeMax}
                      onChange={(val) => setFormData(prev => ({ ...prev, revenueRangeMax: val }))}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="specificBusinessSearch">
                Know exactly what business you're looking for? Tell us!
              </Label>
              <p className="text-xs text-muted-foreground">
                This will help expedite your search so we can send hyper-targeted deals your way.
              </p>
              <Textarea
                id="specificBusinessSearch"
                name="specificBusinessSearch"
                placeholder="I'm looking for a non-union HVAC business with $2-5M EBITDA, established customer contracts..."
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
