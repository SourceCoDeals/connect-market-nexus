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

const steps = [
  "Account Information",
  "Personal Details", 
  "Buyer Type",
  "Buyer Profile",
];

const businessCategories = [
  { value: "any", label: "Any kind of business" },
  { value: "agriculture", label: "Agriculture" },
  { value: "automotive", label: "Automotive / Boat" },
  { value: "beauty", label: "Beauty & Personal Care" },
  { value: "construction", label: "Building & Construction" },
  { value: "communication", label: "Communication / Media" },
  { value: "education", label: "Education / Childcare" },
  { value: "entertainment", label: "Entertainment / Recreation" },
  { value: "financial", label: "Financial Services" },
  { value: "healthcare", label: "Health Care & Fitness" },
  { value: "home", label: "Home Services" },
  { value: "technology", label: "Online / Technology" },
  { value: "other_services", label: "Other Services" },
  { value: "pets", label: "Pet Services" },
  { value: "professional", label: "Professional Services" },
  { value: "restaurants", label: "Restaurants & Food" },
  { value: "retail", label: "Retail" },
  { value: "transportation", label: "Transportation & Storage" },
  { value: "travel", label: "Travel" },
  { value: "wholesale", label: "Wholesale & Distributors" },
  { value: "other", label: "Other" },
];

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
    phone: string;
    buyerType: BuyerType | "";
    additionalInfo: Record<string, any>;
    idealTargetDescription: string;
    businessCategories: string[];
    targetLocations: string;
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
    phone: "",
    buyerType: "",
    additionalInfo: {},
    idealTargetDescription: "",
    businessCategories: [],
    targetLocations: "",
    revenueRangeMin: "",
    revenueRangeMax: "",
    specificBusinessSearch: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdditionalInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      additionalInfo: { ...prev.additionalInfo, [name]: value },
    }));
  };

  const handleBuyerTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      buyerType: value as BuyerType,
      additionalInfo: {}, // Reset additional info when type changes
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
        if (!formData.phone) {
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
            if (!formData.additionalInfo.estimatedRevenue) {
              errors.push("Estimated revenue is required");
            }
            break;
          case "privateEquity":
          case "familyOffice":
            if (!formData.additionalInfo.fundSize) {
              errors.push("Fund size is required");
            }
            break;
          case "searchFund":
            if (formData.additionalInfo.isFunded === undefined) {
              errors.push("Please specify if you're funded");
            }
            break;
          case "individual":
            if (!formData.additionalInfo.fundingSource) {
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
        phone, 
        buyerType, 
        additionalInfo,
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
        phone_number: phone,
        buyer_type: buyerType as BuyerType,
        ideal_target_description: idealTargetDescription,
        business_categories: businessCategories,
        target_locations: targetLocations,
        revenue_range_min: revenueRangeMin ? parseFloat(revenueRangeMin.replace(/[^0-9.]/g, "")) : undefined,
        revenue_range_max: revenueRangeMax ? parseFloat(revenueRangeMax.replace(/[^0-9.]/g, "")) : undefined,
        specific_business_search: specificBusinessSearch,
        ...additionalInfo, // Include all additional info
      };
      
      await signup(signupData, formData.password);
      
      // Show success toast
      toast({
        title: "Account created successfully!",
        description: "Please check your email to verify your account.",
      });
      
      // Navigate to the verify email page after successful signup
      navigate('/verify-email', { state: { email: formData.email } });
      
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
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="(123) 456-7890"
                value={formData.phone}
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
                  value={formData.additionalInfo.estimatedRevenue || ""}
                  onChange={handleAdditionalInfoChange}
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
                    value={formData.additionalInfo.fundSize || ""}
                    onChange={handleAdditionalInfoChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="platformSize">Platform Size</Label>
                  <Input
                    id="platformSize"
                    name="platformSize"
                    placeholder="2-20M"
                    value={formData.additionalInfo.platformSize || ""}
                    onChange={handleAdditionalInfoChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aum">Assets Under Management</Label>
                  <Input
                    id="aum"
                    name="aum"
                    placeholder="$100M"
                    value={formData.additionalInfo.aum || ""}
                    onChange={handleAdditionalInfoChange}
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
                        additionalInfo: {
                          ...prev.additionalInfo,
                          isFunded: value === "yes",
                        },
                      }))
                    }
                    value={
                      formData.additionalInfo.isFunded === undefined
                        ? ""
                        : formData.additionalInfo.isFunded
                        ? "yes"
                        : "no"
                    }
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
                
                {formData.additionalInfo.isFunded && (
                  <div className="space-y-2">
                    <Label htmlFor="funder">Who is your funder?</Label>
                    <Input
                      id="funder"
                      name="funder"
                      placeholder="Investor name"
                      value={formData.additionalInfo.funder || ""}
                      onChange={handleAdditionalInfoChange}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="targetSize">Target size</Label>
                  <Input
                    id="targetSize"
                    name="targetSize"
                    placeholder="$5M-$20M"
                    value={formData.additionalInfo.targetSize || ""}
                    onChange={handleAdditionalInfoChange}
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
                    value={formData.additionalInfo.fundingSource || ""}
                    onChange={handleAdditionalInfoChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sbaLoan">SBA/Bank loan?</Label>
                  <Select
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        additionalInfo: {
                          ...prev.additionalInfo,
                          sbaLoan: value === "yes",
                        },
                      }))
                    }
                    value={
                      formData.additionalInfo.sbaLoan === undefined
                        ? ""
                        : formData.additionalInfo.sbaLoan
                        ? "yes"
                        : "no"
                    }
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
                    value={formData.additionalInfo.idealTarget || ""}
                    onChange={handleAdditionalInfoChange}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {businessCategories.map((category) => (
                  <div key={category.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={category.value}
                      checked={formData.businessCategories.includes(category.value)}
                      onCheckedChange={(checked) =>
                        handleBusinessCategoryChange(category.value, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={category.value}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {category.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetLocations">
                What locations are you considering purchasing in?
              </Label>
              <Input
                id="targetLocations"
                name="targetLocations"
                placeholder="Midwest, Northeast, California, etc."
                value={formData.targetLocations}
                onChange={(e) => setFormData(prev => ({ ...prev, targetLocations: e.target.value }))}
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
    <div className="flex items-center justify-center min-h-screen bg-muted/30 py-8">
      <div className="w-full max-w-lg mx-4 space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center space-y-3">
          <div className="flex items-center">
            <img 
              src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
              alt="SourceCo Logo" 
              className="h-10 w-10 mr-3"
            />
            <div className="text-center">
              <h1 className="text-2xl font-bold">SourceCo</h1>
              <p className="text-lg text-muted-foreground font-light">Marketplace</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              Create an account
            </CardTitle>
            <CardDescription className="text-center">
              Step {currentStep + 1} of {steps.length}: {steps[currentStep]}
            </CardDescription>
            
            {/* Progress bar */}
            <div className="w-full bg-secondary h-2 rounded-full mt-4">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{
                  width: `${((currentStep + 1) / steps.length) * 100}%`,
                }}
              ></div>
            </div>
          </CardHeader>
          <CardContent>
            {validationErrors.length > 0 && (
              <div className="bg-destructive/15 text-destructive p-3 rounded-md mb-4">
                <ul className="list-disc pl-5">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <form onSubmit={handleSubmit}>{renderStepContent()}</form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="flex justify-between w-full">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0 || isLoading || isSubmitting}
              >
                Back
              </Button>
              
              {currentStep === steps.length - 1 ? (
                <Button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isLoading || isSubmitting}
                >
                  {isLoading || isSubmitting ? "Creating account..." : "Create account"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={isLoading || isSubmitting}
                >
                  Continue
                </Button>
              )}
            </div>
            
            <div className="text-sm text-center text-muted-foreground">
              <span>Already have an account? </span>
              <Link
                to="/login"
                className="text-primary font-medium hover:underline"
              >
                Sign in
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Signup;
