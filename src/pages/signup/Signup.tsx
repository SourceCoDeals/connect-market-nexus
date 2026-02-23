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
        dealStructurePreference,
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
        target_locations: targetLocations,
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
        // Referral source tracking (Step 3)
        referral_source: formData.referralSource || '',
        referral_source_detail: formData.referralSourceDetail || '',
        // Deal sourcing questions (Step 3)
        deal_sourcing_methods: formData.dealSourcingMethods || [],
        target_acquisition_volume: formData.targetAcquisitionVolume || '',
      };

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
