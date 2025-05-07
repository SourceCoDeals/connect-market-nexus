
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BuyerType, User } from "@/types";

const steps = [
  "Account Information",
  "Personal Details",
  "Buyer Type",
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
  const [currentStep, setCurrentStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    company: string;
    website: string;
    phone: string;
    buyerType: BuyerType | "";
    additionalInfo: Record<string, any>;
  }>({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    company: "",
    website: "",
    phone: "",
    buyerType: "",
    additionalInfo: {},
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
    
    // Prepare user data for signup
    const userData: Partial<User> = {
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
      company: formData.company,
      website: formData.website,
      phone: formData.phone,
      role: "buyer",
      isEmailVerified: false,
      isApproved: false,
      buyerType: formData.buyerType as BuyerType,
      additionalInfo: formData.additionalInfo,
    };
    
    await signup(userData, formData.password);
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
                    placeholder="5 companies"
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
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 py-8">
      <Card className="w-full max-w-lg mx-4">
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
              disabled={currentStep === 0 || isLoading}
            >
              Back
            </Button>
            
            {currentStep === steps.length - 1 ? (
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Create account"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleNext}
                disabled={isLoading}
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
  );
};

export default Signup;
