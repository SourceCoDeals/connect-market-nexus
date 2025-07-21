
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuthActions } from "@/hooks/auth/use-auth-actions";
import { useAuthState } from "@/hooks/auth/use-auth-state";
import { useRegistrationTracking } from "@/hooks/use-registration-tracking";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordStrengthIndicator } from "@/components/security/PasswordStrengthIndicator";

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp } = useAuthActions();
  const { user, isLoading } = useAuthState();
  const {
    trackRegistrationStepWithTiming,
    trackFormFieldInteraction,
    trackFormValidationError,
    trackFormSubmission,
  } = useRegistrationTracking();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    company: "",
    website: "",
    phoneNumber: "",
    buyerType: "",
    companyName: "",
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
    bio: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track initial landing
  useEffect(() => {
    trackRegistrationStepWithTiming('signup_page_landed', 1);
  }, [trackRegistrationStepWithTiming]);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isLoading) {
      navigate("/dashboard");
    }
  }, [user, isLoading, navigate]);

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) {
      newErrors.email = "Email is required";
      trackFormValidationError('email', 'Email is required');
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
      trackFormValidationError('password', 'Password is required');
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
      trackFormValidationError('confirmPassword', 'Passwords do not match');
    }
    if (!formData.firstName) {
      newErrors.firstName = "First name is required";
      trackFormValidationError('firstName', 'First name is required');
    }
    if (!formData.lastName) {
      newErrors.lastName = "Last name is required";
      trackFormValidationError('lastName', 'Last name is required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.buyerType) {
      newErrors.buyerType = "Buyer type is required";
      trackFormValidationError('buyerType', 'Buyer type is required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    trackFormFieldInteraction(field, value);
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      trackRegistrationStepWithTiming('basic_info_completed', 2, {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      trackRegistrationStepWithTiming('buyer_type_selected', 3, {
        buyerType: formData.buyerType,
      });
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep1() || !validateStep2()) {
      trackFormSubmission('final_submit', false, 'Validation failed');
      return;
    }

    setIsSubmitting(true);

    try {
      trackRegistrationStepWithTiming('form_submission_started', 4, formData);
      
      const { error } = await signUp(
        formData.email,
        formData.password,
        formData
      );

      if (error) {
        trackFormSubmission('signup_attempt', false, error.message);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      trackFormSubmission('signup_attempt', true);
      trackRegistrationStepWithTiming('account_created', 5, { email: formData.email });
      
      toast({
        title: "Account created successfully!",
        description: "Please check your email to verify your account.",
      });
      
      navigate("/email-verification-required");
    } catch (error: any) {
      trackFormSubmission('signup_attempt', false, error.message);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            type="text"
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            className={errors.firstName ? "border-destructive" : ""}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            type="text"
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            className={errors.lastName ? "border-destructive" : ""}
          />
          {errors.lastName && (
            <p className="text-sm text-destructive">{errors.lastName}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          className={errors.email ? "border-destructive" : ""}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => handleInputChange('password', e.target.value)}
          className={errors.password ? "border-destructive" : ""}
        />
        <PasswordStrengthIndicator password={formData.password} />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
          className={errors.confirmPassword ? "border-destructive" : ""}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword}</p>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="buyerType">I am a...</Label>
        <Select
          value={formData.buyerType}
          onValueChange={(value) => handleInputChange('buyerType', value)}
        >
          <SelectTrigger className={errors.buyerType ? "border-destructive" : ""}>
            <SelectValue placeholder="Select buyer type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="corporate">Corporate Buyer</SelectItem>
            <SelectItem value="individual">Individual Investor</SelectItem>
            <SelectItem value="pe_vc">PE/VC Fund</SelectItem>
            <SelectItem value="family_office">Family Office</SelectItem>
            <SelectItem value="search_fund">Search Fund</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        {errors.buyerType && (
          <p className="text-sm text-destructive">{errors.buyerType}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">Company</Label>
        <Input
          id="company"
          type="text"
          value={formData.company}
          onChange={(e) => handleInputChange('company', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Website (Optional)</Label>
        <Input
          id="website"
          type="url"
          value={formData.website}
          onChange={(e) => handleInputChange('website', e.target.value)}
          placeholder="https://example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
        <Input
          id="phoneNumber"
          type="tel"
          value={formData.phoneNumber}
          onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bio">Tell us about yourself and your investment criteria (Optional)</Label>
        <Textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => handleInputChange('bio', e.target.value)}
          placeholder="Describe your background, investment focus, deal size preferences, etc."
          rows={4}
        />
      </div>

      <Alert>
        <AlertDescription>
          Your profile will be reviewed by our team. Once approved, you'll gain access to the marketplace.
        </AlertDescription>
      </Alert>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Create Account</CardTitle>
          <CardDescription className="text-center">
            Step {currentStep} of 3 - Join our marketplace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            <div className="flex justify-between">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={handlePrevStep}>
                  Previous
                </Button>
              )}
              {currentStep < 3 ? (
                <Button type="button" onClick={handleNextStep} className="ml-auto">
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting} className="ml-auto">
                  {isSubmitting ? "Creating Account..." : "Create Account"}
                </Button>
              )}
            </div>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
