import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import bradDaughertyImage from '@/assets/brad-daugherty.png';
import sfcLogo from '@/assets/sfc-logo.png';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { BuyerType } from '@/types';
import { StepIndicator } from '@/components/ui/step-indicator';
import { ArrowLeft } from 'lucide-react';
import { ReferralSourceStep } from '@/components/auth/ReferralSourceStep';

import { SIGNUP_STEPS, INITIAL_FORM_DATA } from './constants';
import { validateStep } from './validation';
import { mapFormToSignupData } from './mapFormToSignupData';
import { AccountInfoStep } from './AccountInfoStep';
import { PersonalDetailsStep } from './PersonalDetailsStep';
import { BuyerTypeStep } from './BuyerTypeStep';
import { BuyerProfileStep } from './BuyerProfileStep';
import { SignupSidePanel } from './SignupSidePanel';
import type { SignupFormData } from './types';

const Signup = () => {
  const { signup, isLoading } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<SignupFormData>(INITIAL_FORM_DATA);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBuyerTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      buyerType: value as BuyerType,
      // Reset buyer-specific fields when type changes
      estimatedRevenue: '',
      fundSize: '',
      investmentSize: [] as string[],
      aum: '',
      isFunded: '',
      fundedBy: '',
      targetCompanySize: '',
      fundingSource: '',
      needsLoan: '',
      idealTarget: '',
      // Reset independent sponsor fields
      targetDealSizeMin: '',
      targetDealSizeMax: '',
      geographicFocus: '',
      industryExpertise: '',
      dealStructurePreference: '',
    }));
  };

  const runValidation = (): boolean => {
    const errors = validateStep(currentStep, formData);
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleNext = () => {
    if (runValidation()) {
      setCurrentStep((prev) => Math.min(prev + 1, SIGNUP_STEPS.length - 1));
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

    if (!runValidation()) {
      // Scroll to top to show validation errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    try {
      const signupData = mapFormToSignupData(formData);
      await signup(signupData, formData.password);

      // Show success toast
      toast({
        title: 'Account created successfully!',
        description: 'Please check your email to verify your account.',
      });

      // Navigate to static success page with email parameter
      navigate(`/signup-success?email=${encodeURIComponent(formData.email)}`);
    } catch (error: unknown) {
      console.error('Signup error:', error);

      // More specific error handling
      let errorMessage = 'An unexpected error occurred. Please try again.';
      const errMsg = error instanceof Error ? error.message : String(error);

      if (errMsg?.includes('User already registered')) {
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (errMsg?.includes('Password')) {
        errorMessage = "Password requirements not met. Please ensure it's at least 6 characters.";
      } else if (errMsg?.includes('Email')) {
        errorMessage = 'Invalid email address. Please check and try again.';
      } else if (errMsg) {
        errorMessage = errMsg;
      }

      toast({
        variant: 'destructive',
        title: 'Signup failed',
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <AccountInfoStep formData={formData} handleInputChange={handleInputChange} />;
      case 1:
        return <PersonalDetailsStep formData={formData} handleInputChange={handleInputChange} />;
      case 2:
        return (
          <ReferralSourceStep
            referralSource={formData.referralSource || ''}
            referralSourceDetail={formData.referralSourceDetail || ''}
            dealSourcingMethods={formData.dealSourcingMethods || []}
            targetAcquisitionVolume={formData.targetAcquisitionVolume || ''}
            onSourceChange={(source) =>
              setFormData((prev) => ({ ...prev, referralSource: source }))
            }
            onDetailChange={(detail) =>
              setFormData((prev) => ({ ...prev, referralSourceDetail: detail }))
            }
            onDealSourcingMethodsChange={(methods) =>
              setFormData((prev) => ({ ...prev, dealSourcingMethods: methods }))
            }
            onTargetAcquisitionVolumeChange={(volume) =>
              setFormData((prev) => ({ ...prev, targetAcquisitionVolume: volume }))
            }
          />
        );
      case 3:
        return (
          <BuyerTypeStep
            formData={formData}
            setFormData={setFormData}
            handleInputChange={handleInputChange}
            handleBuyerTypeChange={handleBuyerTypeChange}
          />
        );
      case 4:
        return <BuyerProfileStep formData={formData} setFormData={setFormData} />;
      default:
        return null;
    }
  };

  const rightContent = (
    <SignupSidePanel bradDaughertyImage={bradDaughertyImage} sfcLogo={sfcLogo} />
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
              {SIGNUP_STEPS[currentStep]}
            </CardDescription>
          </div>

          {/* Step Indicator */}
          <StepIndicator currentStep={currentStep} totalSteps={SIGNUP_STEPS.length} />
        </CardHeader>

        <CardContent className="px-0">
          {validationErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg mb-6">
              <ul className="list-disc pl-4 space-y-1 text-sm">
                {validationErrors.map((error) => (
                  <li key={error}>{error}</li>
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
            {currentStep === SIGNUP_STEPS.length - 1 ? (
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={isLoading || isSubmitting}
                className="w-full text-sm font-medium"
              >
                {isLoading || isSubmitting ? 'Creating account...' : 'Create account'}
              </Button>
            ) : currentStep === 2 ? (
              // Step 3 (index 2) - Referral source step - show Continue + Skip
              <>
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={isLoading || isSubmitting}
                  className="w-full text-sm font-medium"
                >
                  Continue
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    // Clear all Step 3 data and skip to next step
                    setFormData((prev) => ({
                      ...prev,
                      referralSource: '',
                      referralSourceDetail: '',
                      dealSourcingMethods: [],
                      targetAcquisitionVolume: '',
                    }));
                    setCurrentStep((prev) => prev + 1);
                  }}
                  disabled={isLoading || isSubmitting}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip this step
                </button>
              </>
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
