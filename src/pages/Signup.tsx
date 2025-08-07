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

const steps = [
  "Account Information",
  "Personal Details", 
  "Buyer Type",
  "Buyer Profile",
];

import { STANDARDIZED_CATEGORIES } from "@/lib/financial-parser";
import { MultiCategorySelect } from "@/components/ui/category-select";

const buyerTypeOptions = [
  { value: "corporate", label: "Corporate" },
  { value: "privateEquity", label: "Private Equity" },
  { value: "familyOffice", label: "Family Office" },
  { value: "searchFund", label: "Search Fund" },
  { value: "individual", label: "Individual" },
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
        }
        break;
      }
      case 3: {
        // Buyer profile validation
        if (!formData.idealTargetDescription.trim()) {
          errors.push("Please describe your ideal targets");
        }
        if (formData.businessCategories.length === 0) {
          errors.push("Please select at least one business category");
        }
        if (formData.revenueRangeMin && formData.revenueRangeMax) {
          const min = parseFloat(formData.revenueRangeMin.replace(/[^0-9.]/g, ""));
          const max = parseFloat(formData.revenueRangeMax.replace(/[^0-9.]/g, ""));
          if (min >= max) {
            errors.push("Maximum revenue must be greater than minimum revenue");
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
        specificBusinessSearch
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
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Conditional fields based on buyer type */}
            {formData.buyerType === "corporate" && (
              <div className="space-y-2">
                <Label htmlFor="estimatedRevenue">Estimated Revenue</Label>
                <Input
                  id="estimatedRevenue"
                  name="estimatedRevenue"
                  placeholder="$1M-$5M"
                  value={formData.estimatedRevenue}
                  onChange={handleBuyerSpecificChange}
                  required
                />
              </div>
            )}
            
            {(formData.buyerType === "privateEquity" || formData.buyerType === "familyOffice") && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fundSize">Fund Size</Label>
                  <Input
                    id="fundSize"
                    name="fundSize"
                    placeholder="$10M-$50M"
                    value={formData.fundSize}
                    onChange={handleBuyerSpecificChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="investmentSize">Investment Size</Label>
                  <Input
                    id="investmentSize"
                    name="investmentSize"
                    placeholder="$1M-$10M"
                    value={formData.investmentSize}
                    onChange={handleBuyerSpecificChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aum">Assets Under Management</Label>
                  <Input
                    id="aum"
                    name="aum"
                    placeholder="$100M"
                    value={formData.aum}
                    onChange={handleBuyerSpecificChange}
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
                  <Input
                    id="targetCompanySize"
                    name="targetCompanySize"
                    placeholder="$5M-$20M"
                    value={formData.targetCompanySize}
                    onChange={handleBuyerSpecificChange}
                  />
                </div>
              </div>
            )}
            
            {formData.buyerType === "individual" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fundingSource">Funding Source</Label>
                  <Input
                    id="fundingSource"
                    name="fundingSource"
                    placeholder="Personal funds, investors, etc."
                    value={formData.fundingSource}
                    onChange={handleBuyerSpecificChange}
                    required
                  />
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

            {/* Only show revenue range if buyer type is not Private Equity */}
            {formData.buyerType !== "privateEquity" && (
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  What is the revenue range you're looking for in a potential acquisition?
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="revenueRangeMin">$ Minimum</Label>
                    <Input
                      id="revenueRangeMin"
                      name="revenueRangeMin"
                      placeholder="500,000"
                      value={formData.revenueRangeMin}
                      onChange={(e) => setFormData(prev => ({ ...prev, revenueRangeMin: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revenueRangeMax">$ Maximum</Label>
                    <Input
                      id="revenueRangeMax"
                      name="revenueRangeMax"
                      placeholder="5,000,000"
                      value={formData.revenueRangeMax}
                      onChange={(e) => setFormData(prev => ({ ...prev, revenueRangeMax: e.target.value }))}
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
