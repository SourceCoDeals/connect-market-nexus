import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  User, 
  Briefcase, 
  Target,
  AlertCircle,
  Info
} from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STANDARDIZED_CATEGORIES } from "@/lib/financial-parser";
import { MultiCategorySelect } from "@/components/ui/category-select";
import { CurrencyInputEnhanced } from "@/components/ui/currency-input-enhanced";

const steps = [
  "Account Information",
  "Personal Details", 
  "Buyer Type",
  "Buyer Profile",
];

const buyerTypeOptions = [
  { value: "corporate", label: "Corporate", description: "Operating companies looking to acquire complementary businesses" },
  { value: "privateEquity", label: "Private Equity", description: "Professional investment firms managing institutional capital" },
  { value: "familyOffice", label: "Family Office", description: "Private wealth management entities making direct investments" },
  { value: "searchFund", label: "Search Fund", description: "Entrepreneurs seeking to acquire and operate a single company" },
  { value: "individual", label: "Individual", description: "Individual investors using personal capital or SBA financing" },
  { value: "independentSponsor", label: "Independent Sponsor", description: "Investment professionals sourcing deals without permanent capital" },
];

// Debug logging to verify buyer type options are loaded
console.log('🔍 SIGNUP DEBUG - buyerTypeOptions loaded:', buyerTypeOptions.length, 'options');
console.log('🔍 SIGNUP DEBUG - includes independentSponsor:', buyerTypeOptions.some(opt => opt.value === 'independentSponsor'));

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
    phoneNumber: string;
    website: string;
    linkedinProfile: string;
    buyerType: string;
    idealTargetDescription: string;
    businessCategories: string[];
    targetLocations: string[] | string;
    revenueRangeMin: string;
    revenueRangeMax: string;
    specificBusinessSearch: string;
    // Buyer-specific fields
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
    // Independent Sponsor specific fields
    targetDealSizeMin: string;
    targetDealSizeMax: string;
    geographicFocus: string[];
    industryExpertise: string[];
    dealStructurePreference: string;
  }>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    company: '',
    phoneNumber: '',
    website: '',
    linkedinProfile: '',
    buyerType: '',
    idealTargetDescription: '',
    businessCategories: [],
    targetLocations: [],
    revenueRangeMin: '',
    revenueRangeMax: '',
    specificBusinessSearch: '',
    // Buyer-specific fields
    estimatedRevenue: '',
    fundSize: '',
    investmentSize: '',
    aum: '',
    isFunded: '',
    fundedBy: '',
    targetCompanySize: '',
    fundingSource: '',
    needsLoan: '',
    idealTarget: '',
    // Independent Sponsor specific fields
    targetDealSizeMin: '',
    targetDealSizeMax: '',
    geographicFocus: [],
    industryExpertise: [],
    dealStructurePreference: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleBuyerSpecificChange = (e: React.ChangeEvent<HTMLInputElement> | { target: { name: string; value: any } }) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleBuyerTypeChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      buyerType: value
    }));
  };

  const validateStep = (step: number): boolean => {
    const errors: string[] = [];
    
    switch (step) {
      case 0: // Account Information
        if (!formData.email || !formData.password || !formData.confirmPassword) {
          errors.push("All fields are required");
        }
        if (formData.password !== formData.confirmPassword) {
          errors.push("Passwords do not match");
        }
        break;
        
      case 1: // Personal Details
        if (!formData.firstName || !formData.lastName || !formData.company || !formData.phoneNumber || !formData.website || !formData.linkedinProfile) {
          errors.push("All fields are required including website and LinkedIn profile");
        }
        break;
        
      case 2: // Buyer Type
        if (!formData.buyerType) {
          errors.push("Please select a buyer type");
        }
        break;
        
      case 3: // Buyer Profile
        // Basic profile fields
        if (!formData.idealTargetDescription || formData.idealTargetDescription.length < 50) {
          errors.push("Ideal target description must be at least 50 characters");
        }
        
        // Business categories validation
        if (!formData.businessCategories?.length) {
          errors.push("Please select at least 2 business categories or 'All Industries'");
        } else if (formData.businessCategories.length === 1 && !formData.businessCategories.includes('All Industries')) {
          errors.push("Please select at least 2 specific categories or choose 'All Industries'");
        }
        
        if (!formData.targetLocations?.length) {
          errors.push("Please specify at least one target location");
        }
        
        // Revenue ranges (for most buyer types)
        if (formData.buyerType !== 'privateEquity' && formData.buyerType !== 'independentSponsor') {
          if (!formData.revenueRangeMin || !formData.revenueRangeMax) {
            errors.push("Both minimum and maximum revenue ranges are required");
          }
        }
        
        // Buyer type specific validations
        if (formData.buyerType === 'corporate' && !formData.estimatedRevenue) {
          errors.push("Estimated revenue is required for corporate buyers");
        }
        
        if ((formData.buyerType === 'privateEquity' || formData.buyerType === 'familyOffice') && 
            (!formData.fundSize || !formData.investmentSize || !formData.aum)) {
          errors.push("Fund size, investment size, and AUM are required");
        }
        
        if (formData.buyerType === 'searchFund' && (!formData.isFunded || !formData.targetCompanySize)) {
          errors.push("Funding status and target company size are required");
        }
        
        if (formData.buyerType === 'individual' && (!formData.fundingSource || !formData.needsLoan || !formData.idealTarget)) {
          errors.push("Funding source, loan requirements, and ideal target are required");
        }
        
        if (formData.buyerType === 'independentSponsor') {
          if (!formData.investmentSize || !formData.targetDealSizeMin || !formData.targetDealSizeMax || 
              !formData.geographicFocus?.length || !formData.industryExpertise?.length || !formData.dealStructurePreference) {
            errors.push("All Independent Sponsor fields are required");
          }
        }
        break;
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await signup({
        email: formData.email,
        password: formData.password,
        metadata: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          company: formData.company,
          phone_number: formData.phoneNumber,
          website: formData.website,
          linkedin_profile: formData.linkedinProfile,
          buyer_type: formData.buyerType,
          ideal_target_description: formData.idealTargetDescription,
          business_categories: formData.businessCategories,
          target_locations: formData.targetLocations,
          revenue_range_min: formData.revenueRangeMin,
          revenue_range_max: formData.revenueRangeMax,
          specific_business_search: formData.specificBusinessSearch,
          // Buyer-specific fields
          estimated_revenue: formData.estimatedRevenue,
          fund_size: formData.fundSize,
          investment_size: formData.investmentSize,
          aum: formData.aum,
          is_funded: formData.isFunded,
          funded_by: formData.fundedBy,
          target_company_size: formData.targetCompanySize,
          funding_source: formData.fundingSource,
          needs_loan: formData.needsLoan,
          ideal_target: formData.idealTarget,
          // Independent Sponsor specific fields
          target_deal_size_min: formData.targetDealSizeMin,
          target_deal_size_max: formData.targetDealSizeMax,
          geographic_focus: formData.geographicFocus,
          industry_expertise: formData.industryExpertise,
          deal_structure_preference: formData.dealStructurePreference,
        }
      });
      
      navigate("/signup-success");
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Handle specific error cases
      if (error.message?.includes('already registered')) {
        setValidationErrors(['This email is already registered. Please try logging in instead.']);
      } else if (error.message?.includes('Invalid email')) {
        setValidationErrors(['Please enter a valid email address.']);
      } else if (error.message?.includes('Password')) {
        setValidationErrors(['Password must be at least 6 characters long.']);
      } else {
        setValidationErrors(['An error occurred during signup. Please try again.']);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <User className="h-12 w-12 mx-auto text-primary mb-2" />
              <h2 className="text-xl font-semibold">Create Your Account</h2>
              <p className="text-sm text-muted-foreground">Let's start with your basic information</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="john@company.com"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter a secure password"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
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
            <div className="text-center mb-6">
              <Briefcase className="h-12 w-12 mx-auto text-primary mb-2" />
              <h2 className="text-xl font-semibold">Personal & Professional Details</h2>
              <p className="text-sm text-muted-foreground">Tell us about yourself and your business</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
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
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Smith"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                name="company"
                placeholder="Company Name"
                value={formData.company}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                placeholder="+1 (555) 123-4567"
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
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Target className="h-12 w-12 mx-auto text-primary mb-2" />
              <h2 className="text-xl font-semibold">What Type of Buyer Are You?</h2>
              <p className="text-sm text-muted-foreground">This helps us show you the most relevant opportunities</p>
            </div>

            <div className="space-y-4">
              <Label htmlFor="buyerType">Buyer Type *</Label>
              <Select 
                key={`buyer-select-${Date.now()}`}
                value={formData.buyerType} 
                onValueChange={(value) => {
                  console.log('🔍 SIGNUP DEBUG - Buyer type changed to:', value);
                  handleBuyerTypeChange(value);
                }} 
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your buyer type" />
                </SelectTrigger>
                <SelectContent>
                  {buyerTypeOptions.map((option) => {
                    console.log('🔍 SIGNUP DEBUG - Rendering option:', option.value, option.label);
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-muted-foreground">{option.description}</div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {formData.buyerType && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>{buyerTypeOptions.find(opt => opt.value === formData.buyerType)?.label}:</strong>
                  {" " + buyerTypeOptions.find(opt => opt.value === formData.buyerType)?.description}
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Target className="h-12 w-12 mx-auto text-primary mb-2" />
              <h2 className="text-xl font-semibold">Your Investment Profile</h2>
              <p className="text-sm text-muted-foreground">Help us understand your acquisition criteria</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessCategories">Business Categories *</Label>
              <MultiCategorySelect
                value={Array.isArray(formData.businessCategories) ? formData.businessCategories : []}
                onValueChange={(categories) => {
                  setFormData(prev => ({
                    ...prev,
                    businessCategories: categories
                  }));
                }}
                placeholder="Select at least 2 categories or 'All Industries'"
              />
              <p className="text-xs text-muted-foreground">
                Choose at least 2 specific categories or select "All Industries" if you invest across all sectors
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetLocations">Target Locations *</Label>
              <Input
                id="targetLocations"
                name="targetLocations"
                placeholder="e.g., California, Texas, New York"
                value={Array.isArray(formData.targetLocations) ? formData.targetLocations.join(', ') : formData.targetLocations || ''}
                onChange={(e) => {
                  const locations = e.target.value.split(',').map(loc => loc.trim()).filter(Boolean);
                  setFormData(prev => ({
                    ...prev,
                    targetLocations: locations
                  }));
                }}
                required
              />
              <p className="text-xs text-muted-foreground">
                Specify at least one geographic area of interest
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="idealTargetDescription">Ideal Target Description *</Label>
              <textarea
                id="idealTargetDescription"
                name="idealTargetDescription"
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Describe your ideal acquisition target, including industry preferences, size criteria, and specific characteristics... (minimum 50 characters)"
                value={formData.idealTargetDescription}
                onChange={handleInputChange}
                required
                minLength={50}
              />
              <p className="text-xs text-muted-foreground">
                {formData.idealTargetDescription?.length || 0}/50 characters minimum
              </p>
            </div>

            {(formData.buyerType !== 'privateEquity' && formData.buyerType !== 'independentSponsor') && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="revenueRangeMin">Minimum Revenue *</Label>
                  <CurrencyInputEnhanced
                    id="revenueRangeMin"
                    name="revenueRangeMin"
                    placeholder="1,000,000"
                    value={formData.revenueRangeMin}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revenueRangeMax">Maximum Revenue *</Label>
                  <CurrencyInputEnhanced
                    id="revenueRangeMax"
                    name="revenueRangeMax"
                    placeholder="10,000,000"
                    value={formData.revenueRangeMax}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="specificBusinessSearch">Specific Business Search</Label>
              <Input
                id="specificBusinessSearch"
                name="specificBusinessSearch"
                placeholder="Any specific company names or types you're looking for?"
                value={formData.specificBusinessSearch}
                onChange={handleInputChange}
              />
            </div>

            {/* Buyer-specific fields */}
            {formData.buyerType === 'corporate' && (
              <div className="space-y-2">
                <Label htmlFor="estimatedRevenue">Estimated Annual Revenue *</Label>
                <CurrencyInputEnhanced
                  id="estimatedRevenue"
                  name="estimatedRevenue"
                  placeholder="5,000,000"
                  value={formData.estimatedRevenue}
                  onChange={handleBuyerSpecificChange}
                  required
                />
              </div>
            )}

            {formData.buyerType === 'privateEquity' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fundSize">Fund Size *</Label>
                  <CurrencyInputEnhanced
                    id="fundSize"
                    name="fundSize"
                    placeholder="100,000,000"
                    value={formData.fundSize}
                    onChange={handleBuyerSpecificChange}
                    required
                    suffix="(e.g., $100M-$500M)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="investmentSize">Typical Investment Size *</Label>
                  <CurrencyInputEnhanced
                    id="investmentSize"
                    name="investmentSize"
                    placeholder="5,000,000"
                    value={formData.investmentSize}
                    onChange={handleBuyerSpecificChange}
                    required
                    suffix="(e.g., $5M-$25M)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aum">Assets Under Management (AUM) *</Label>
                  <CurrencyInputEnhanced
                    id="aum"
                    name="aum"
                    placeholder="1,000,000,000"
                    value={formData.aum}
                    onChange={handleBuyerSpecificChange}
                    required
                    suffix="(e.g., $1B+)"
                  />
                </div>
              </div>
            )}

            {formData.buyerType === 'familyOffice' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fundSize">Fund Size *</Label>
                  <CurrencyInputEnhanced
                    id="fundSize"
                    name="fundSize"
                    placeholder="50,000,000"
                    value={formData.fundSize}
                    onChange={handleBuyerSpecificChange}
                    required
                    suffix="(e.g., $50M-$200M)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="investmentSize">Typical Investment Size *</Label>
                  <CurrencyInputEnhanced
                    id="investmentSize"
                    name="investmentSize"
                    placeholder="2,000,000"
                    value={formData.investmentSize}
                    onChange={handleBuyerSpecificChange}
                    required
                    suffix="(e.g., $2M-$15M)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aum">Assets Under Management (AUM) *</Label>
                  <CurrencyInputEnhanced
                    id="aum"
                    name="aum"
                    placeholder="500,000,000"
                    value={formData.aum}
                    onChange={handleBuyerSpecificChange}
                    required
                    suffix="(e.g., $500M+)"
                  />
                </div>
              </div>
            )}

            {formData.buyerType === 'searchFund' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="isFunded">Are you funded? *</Label>
                  <Select value={formData.isFunded} onValueChange={(value) => handleBuyerSpecificChange({ target: { name: 'isFunded', value } } as any)} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select funding status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="seeking">Seeking funding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.isFunded === 'yes' && (
                  <div className="space-y-2">
                    <Label htmlFor="fundedBy">Funded by *</Label>
                    <Input
                      id="fundedBy"
                      name="fundedBy"
                      placeholder="e.g., University endowment, Family office"
                      value={formData.fundedBy}
                      onChange={handleBuyerSpecificChange}
                      required
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="targetCompanySize">Target Company Size *</Label>
                  <Input
                    id="targetCompanySize"
                    name="targetCompanySize"
                    placeholder="$2M - $15M revenue"
                    value={formData.targetCompanySize}
                    onChange={handleBuyerSpecificChange}
                    required
                  />
                </div>
              </div>
            )}

            {formData.buyerType === 'individual' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fundingSource">Primary Funding Source *</Label>
                  <Select value={formData.fundingSource} onValueChange={(value) => handleBuyerSpecificChange({ target: { name: 'fundingSource', value } } as any)} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select funding source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Personal capital</SelectItem>
                      <SelectItem value="sba">SBA loan</SelectItem>
                      <SelectItem value="bank">Bank financing</SelectItem>
                      <SelectItem value="investor">Private investors</SelectItem>
                      <SelectItem value="mixed">Mixed sources</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="needsLoan">Will you need SBA/Bank loan? *</Label>
                  <Select value={formData.needsLoan} onValueChange={(value) => handleBuyerSpecificChange({ target: { name: 'needsLoan', value } } as any)} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select loan requirement" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="maybe">Maybe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="idealTarget">Ideal Target *</Label>
                  <Input
                    id="idealTarget"
                    name="idealTarget"
                    placeholder="Small business with steady cash flow"
                    value={formData.idealTarget}
                    onChange={handleBuyerSpecificChange}
                    required
                  />
                </div>
              </div>
            )}

            {formData.buyerType === 'independentSponsor' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="investmentSize">Typical Investment Size *</Label>
                  <CurrencyInputEnhanced
                    id="investmentSize"
                    name="investmentSize"
                    placeholder="10,000,000"
                    value={formData.investmentSize}
                    onChange={handleBuyerSpecificChange}
                    required
                    suffix="(e.g., $10M-$50M)"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="targetDealSizeMin">Min Deal Size *</Label>
                    <CurrencyInputEnhanced
                      id="targetDealSizeMin"
                      name="targetDealSizeMin"
                      placeholder="5,000,000"
                      value={formData.targetDealSizeMin}
                      onChange={handleBuyerSpecificChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetDealSizeMax">Max Deal Size *</Label>
                    <CurrencyInputEnhanced
                      id="targetDealSizeMax"
                      name="targetDealSizeMax"
                      placeholder="100,000,000"
                      value={formData.targetDealSizeMax}
                      onChange={handleBuyerSpecificChange}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="geographicFocus">Geographic Focus *</Label>
                  <Input
                    id="geographicFocus"
                    name="geographicFocus"
                    placeholder="e.g., North America, Southeast US, California"
                    value={Array.isArray(formData.geographicFocus) ? formData.geographicFocus.join(', ') : formData.geographicFocus || ''}
                    onChange={(e) => {
                      const locations = e.target.value.split(',').map(loc => loc.trim()).filter(Boolean);
                      handleBuyerSpecificChange({ target: { name: 'geographicFocus', value: locations } } as any);
                    }}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="industryExpertise">Industry Expertise *</Label>
                  <Input
                    id="industryExpertise"
                    name="industryExpertise"
                    placeholder="e.g., Healthcare, Technology, Manufacturing"
                    value={Array.isArray(formData.industryExpertise) ? formData.industryExpertise.join(', ') : formData.industryExpertise || ''}
                    onChange={(e) => {
                      const industries = e.target.value.split(',').map(ind => ind.trim()).filter(Boolean);
                      handleBuyerSpecificChange({ target: { name: 'industryExpertise', value: industries } } as any);
                    }}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dealStructurePreference">Deal Structure Preference *</Label>
                  <Select value={formData.dealStructurePreference} onValueChange={(value) => handleBuyerSpecificChange({ target: { name: 'dealStructurePreference', value } } as any)} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select preferred deal structure" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="majority">Majority equity acquisition</SelectItem>
                      <SelectItem value="minority">Minority equity investment</SelectItem>
                      <SelectItem value="asset">Asset acquisition</SelectItem>
                      <SelectItem value="merger">Merger transaction</SelectItem>
                      <SelectItem value="flexible">Flexible structure</SelectItem>
                    </SelectContent>
                  </Select>
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Form */}
            <div>
              <Card className="w-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Create Account</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      Step {currentStep + 1} of {steps.length}
                    </div>
                  </div>
                  <Progress value={((currentStep + 1) / steps.length) * 100} className="mt-2" />
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Error Display */}
                  {validationErrors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {validationErrors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Step Content */}
                  {renderStepContent()}

                  {/* Navigation Buttons */}
                  <div className="flex justify-between pt-6">
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={currentStep === 0}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>

                    {currentStep === steps.length - 1 ? (
                      <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || isLoading}
                        className="min-w-[120px]"
                      >
                        {isSubmitting || isLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Creating...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Create Account
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button onClick={handleNext}>
                        Continue
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </div>

                  {/* Login Link */}
                  <div className="text-center pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <Link to="/login" className="text-primary hover:underline">
                        Sign in here
                      </Link>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Information */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-success" />
                    Why SourceCo?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                      <div>
                        <h4 className="font-medium">Curated Opportunities</h4>
                        <p className="text-sm text-muted-foreground">
                          Pre-screened businesses that match your investment criteria
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                      <div>
                        <h4 className="font-medium">Direct Owner Access</h4>
                        <p className="text-sm text-muted-foreground">
                          Connect directly with business owners, no middlemen
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                      <div>
                        <h4 className="font-medium">Smart Matching</h4>
                        <p className="text-sm text-muted-foreground">
                          AI-powered recommendations based on your profile
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Current Step: {steps[currentStep]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {steps.map((step, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                          index === currentStep
                            ? 'bg-primary/10 text-primary'
                            : index < currentStep
                            ? 'bg-success/10 text-success'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {index < currentStep ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : index === currentStep ? (
                          <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary/20" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                        )}
                        <span className="text-sm font-medium">{step}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;