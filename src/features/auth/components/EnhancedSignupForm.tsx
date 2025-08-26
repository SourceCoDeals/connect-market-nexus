import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MultiSelect } from '@/components/ui/multi-select';
import { signupFormSchema, type SignupFormData, useProtectedAuth } from '@/features/auth';
import { 
  BUYER_TYPE_OPTIONS,
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
} from '@/lib/signup-field-options';

export const EnhancedSignupForm: React.FC = () => {
  const { signup, isLoading } = useProtectedAuth();
  const [currentStep, setCurrentStep] = useState(0);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      company: '',
      buyerType: 'privateEquity'
    }
  });

  const { watch, setValue, handleSubmit, formState: { errors } } = form;
  const buyerType = watch('buyerType');

  const onSubmit = async (data: SignupFormData) => {
    try {
      // Transform data to match User interface
      const userData = {
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        company: data.company,
        website: data.website || '',
        phone_number: data.phone_number || '',
        linkedin_profile: data.linkedinProfile || '',
        buyer_type: data.buyerType,
        ideal_target_description: data.idealTargetDescription,
        business_categories: data.businessCategories,
        target_locations: data.targetLocations,
        revenue_range_min: data.revenueRangeMin,
        revenue_range_max: data.revenueRangeMax,
        specific_business_search: data.specificBusinessSearch,
        
        // Common fields
        job_title: data.jobTitle,
        
        // Buyer-specific fields
        estimated_revenue: data.estimatedRevenue,
        fund_size: data.fundSize,
        investment_size: data.investmentSize,
        aum: data.aum,
        is_funded: data.isFunded,
        funded_by: data.fundedBy,
        target_company_size: data.targetCompanySize,
        funding_source: data.fundingSource,
        needs_loan: data.needsLoan,
        ideal_target: data.idealTarget,
        
        // New PE fields
        portfolio_company_addon: data.portfolioCompanyAddon,
        deploying_capital_now: data.deployingCapitalNow,
        
        // Corporate fields
        owning_business_unit: data.owningBusinessUnit,
        deal_size_band: data.dealSizeBand,
        integration_plan: data.integrationPlan,
        corpdev_intent: data.corpdevIntent,
        
        // Family Office fields
        discretion_type: data.discretionType,
        permanent_capital: data.permanentCapital,
        operating_company_targets: data.operatingCompanyTargets,
        
        // Independent Sponsor fields
        committed_equity_band: data.committedEquityBand,
        equity_source: data.equitySource,
        flex_subxm_ebitda: data.flexSubXmEbitda,
        backers_summary: data.backersSummary,
        deployment_timing: data.deploymentTiming,
        
        // Search Fund fields
        search_type: data.searchType,
        acq_equity_band: data.acqEquityBand,
        financing_plan: data.financingPlan,
        flex_sub2m_ebitda: data.flexSub2mEbitda,
        anchor_investors_summary: data.anchorInvestorsSummary,
        search_stage: data.searchStage,
        
        // Advisor fields
        on_behalf_of_buyer: data.onBehalfOfBuyer,
        buyer_role: data.buyerRole,
        buyer_org_url: data.buyerOrgUrl,
        mandate_blurb: data.mandateBlurb,
        
        // Business Owner fields
        owner_intent: data.ownerIntent,
        owner_timeline: data.ownerTimeline,
        
        // Individual fields
        max_equity_today_band: data.maxEquityTodayBand,
        uses_bank_finance: data.usesBankFinance,
        
        // New Step 4 fields
        deal_intent: data.dealIntent,
        exclusions: data.exclusions,
        include_keywords: data.includeKeywords
      };

      await signup(userData, data.password);
    } catch (error) {
      console.error('Signup error:', error);
    }
  };

  const renderBuyerSpecificFields = () => {
    switch (buyerType) {
      case 'privateEquity':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="portfolioCompanyAddon">Portfolio Company Add-on (Optional)</Label>
              <Input
                id="portfolioCompanyAddon"
                placeholder="Which portfolio company would this be an add-on to?"
                {...form.register('portfolioCompanyAddon')}
              />
              <p className="text-sm text-muted-foreground mt-1">
                If this acquisition would be an add-on to an existing portfolio company, specify which one.
              </p>
            </div>

            <div>
              <Label htmlFor="deployingCapitalNow">Deploying Capital Now? *</Label>
              <Select onValueChange={(value) => setValue('deployingCapitalNow', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select deployment status" />
                </SelectTrigger>
                <SelectContent>
                  {DEPLOYING_CAPITAL_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Are you actively deploying capital or between funds?
              </p>
            </div>

            {/* Existing PE fields */}
            <div>
              <Label htmlFor="fundSize">Fund Size</Label>
              <Input
                id="fundSize"
                placeholder="e.g., $100M - $500M"
                {...form.register('fundSize')}
              />
            </div>
            <div>
              <Label htmlFor="investmentSize">Investment Size</Label>
              <Input
                id="investmentSize"
                placeholder="e.g., $10M - $50M"
                {...form.register('investmentSize')}
              />
            </div>
            <div>
              <Label htmlFor="aum">Assets Under Management</Label>
              <Input
                id="aum"
                placeholder="e.g., $500M - $1B"
                {...form.register('aum')}
              />
            </div>
          </div>
        );

      case 'corporate':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="owningBusinessUnit">Owning Business Unit / Brand (Optional)</Label>
              <Input
                id="owningBusinessUnit"
                placeholder="Which business unit would own this acquisition?"
                {...form.register('owningBusinessUnit')}
              />
              <p className="text-sm text-muted-foreground mt-1">
                The specific division or brand that would integrate this acquisition.
              </p>
            </div>

            <div>
              <Label htmlFor="dealSizeBand">Deal Size (EV) *</Label>
              <Select onValueChange={(value) => setValue('dealSizeBand', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select deal size range" />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_SIZE_BAND_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Integration Plan (Optional)</Label>
              <MultiSelect
                options={INTEGRATION_PLAN_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
                selected={watch('integrationPlan') || []}
                onSelectedChange={(selected) => setValue('integrationPlan', selected)}
                placeholder="Select integration approaches"
              />
              <p className="text-sm text-muted-foreground mt-1">
                How would you integrate this acquisition into your business?
              </p>
            </div>

            <div>
              <Label htmlFor="corpdevIntent">Speed/Intent (Optional)</Label>
              <Select onValueChange={(value) => setValue('corpdevIntent', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your current intent" />
                </SelectTrigger>
                <SelectContent>
                  {CORPDEV_INTENT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="estimatedRevenue">Estimated Revenue</Label>
              <Input
                id="estimatedRevenue"
                placeholder="e.g., $100M - $500M"
                {...form.register('estimatedRevenue')}
              />
            </div>
          </div>
        );

      case 'familyOffice':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="discretionType">Decision Authority *</Label>
              <Select onValueChange={(value) => setValue('discretionType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select decision authority" />
                </SelectTrigger>
                <SelectContent>
                  {DISCRETION_TYPE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Do you have discretionary authority or are you advisory-only?
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="permanentCapital"
                checked={watch('permanentCapital') || false}
                onCheckedChange={(checked) => setValue('permanentCapital', checked as boolean)}
              />
              <Label htmlFor="permanentCapital">Permanent Capital</Label>
              <p className="text-sm text-muted-foreground">
                Check if you have permanent capital structure
              </p>
            </div>

            <div>
              <Label>Operating Company Targets (Optional)</Label>
              <MultiSelect
                options={[]}
                selected={watch('operatingCompanyTargets') || []}
                onSelectedChange={(selected) => setValue('operatingCompanyTargets', selected)}
                placeholder="Add operating companies this would add onto"
                maxSelected={3}
              />
              <p className="text-sm text-muted-foreground mt-1">
                If you have an operating company this would add onto, name it (max 3).
              </p>
            </div>

            {/* Existing Family Office fields */}
            <div>
              <Label htmlFor="fundSize">Fund Size</Label>
              <Input
                id="fundSize"
                placeholder="e.g., $50M - $100M"
                {...form.register('fundSize')}
              />
            </div>
            <div>
              <Label htmlFor="investmentSize">Investment Size</Label>
              <Input
                id="investmentSize"
                placeholder="e.g., $5M - $25M"
                {...form.register('investmentSize')}
              />
            </div>
            <div>
              <Label htmlFor="aum">Assets Under Management</Label>
              <Input
                id="aum"
                placeholder="e.g., $100M - $500M"
                {...form.register('aum')}
              />
            </div>
          </div>
        );

      case 'independentSponsor':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="committedEquityBand">Committed Equity Available Today *</Label>
              <Select onValueChange={(value) => setValue('committedEquityBand', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select equity available" />
                </SelectTrigger>
                <SelectContent>
                  {COMMITTED_EQUITY_BAND_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                How much equity do you have committed and available today?
              </p>
            </div>

            <div>
              <Label>Source of Equity *</Label>
              <MultiSelect
                options={EQUITY_SOURCE_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
                selected={watch('equitySource') || []}
                onSelectedChange={(selected) => setValue('equitySource', selected)}
                placeholder="Select all that apply"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Where does your equity come from? Select all that apply.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="flexSubXmEbitda"
                checked={watch('flexSubXmEbitda') || false}
                onCheckedChange={(checked) => setValue('flexSubXmEbitda', checked as boolean)}
              />
              <Label htmlFor="flexSubXmEbitda">Flexible on size? *</Label>
              <p className="text-sm text-muted-foreground">
                Can you pursue opportunities with lower EBITDA?
              </p>
            </div>

            <div>
              <Label htmlFor="backersSummary">Representative Backers (Optional)</Label>
              <Input
                id="backersSummary"
                placeholder="e.g., Smith Capital; Oak Family Office"
                {...form.register('backersSummary')}
              />
              <p className="text-sm text-muted-foreground mt-1">
                One line summary of your key backers or investors.
              </p>
            </div>

            <div>
              <Label htmlFor="deploymentTiming">Readiness Window (Optional)</Label>
              <Select onValueChange={(value) => setValue('deploymentTiming', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select readiness timeline" />
                </SelectTrigger>
                <SelectContent>
                  {DEPLOYMENT_TIMING_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'searchFund':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="searchType">Search Type *</Label>
              <Select onValueChange={(value) => setValue('searchType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select search type" />
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_TYPE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Are you running a traditional search fund with committed investors or self-funded?
              </p>
            </div>

            <div>
              <Label htmlFor="acqEquityBand">Equity Available for Acquisition at Close *</Label>
              <Select onValueChange={(value) => setValue('acqEquityBand', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select equity available" />
                </SelectTrigger>
                <SelectContent>
                  {ACQ_EQUITY_BAND_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Financing Plan *</Label>
              <MultiSelect
                options={FINANCING_PLAN_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
                selected={watch('financingPlan') || []}
                onSelectedChange={(selected) => setValue('financingPlan', selected)}
                placeholder="Select all that apply"
              />
              <p className="text-sm text-muted-foreground mt-1">
                What financing structures are you considering? Select all that apply.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="flexSub2mEbitda"
                checked={watch('flexSub2mEbitda') || false}
                onCheckedChange={(checked) => setValue('flexSub2mEbitda', checked as boolean)}
              />
              <Label htmlFor="flexSub2mEbitda">Flexible on size? (can pursue less than $2M EBITDA) *</Label>
            </div>

            <div>
              <Label htmlFor="anchorInvestorsSummary">Anchor Investors / Committed Backers (Optional)</Label>
              <Input
                id="anchorInvestorsSummary"
                placeholder="e.g., XYZ Capital; ABC Family Office"
                {...form.register('anchorInvestorsSummary')}
              />
              <p className="text-sm text-muted-foreground mt-1">
                One line summary of your committed investors or backers.
              </p>
            </div>

            <div>
              <Label htmlFor="searchStage">Stage of Search (Optional)</Label>
              <Select onValueChange={(value) => setValue('searchStage', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select current stage" />
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_STAGE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'advisor':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="onBehalfOfBuyer">Are you inquiring on behalf of a capitalized buyer with discretion? *</Label>
              <Select onValueChange={(value) => setValue('onBehalfOfBuyer', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select yes or no" />
                </SelectTrigger>
                <SelectContent>
                  {ON_BEHALF_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {watch('onBehalfOfBuyer') === 'yes' && (
              <>
                <div>
                  <Label htmlFor="buyerRole">Buyer Role *</Label>
                  <Select onValueChange={(value) => setValue('buyerRole', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select buyer role" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUYER_ROLE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="buyerOrgUrl">Buyer Organization Website *</Label>
                  <Input
                    id="buyerOrgUrl"
                    type="url"
                    placeholder="https://example.com"
                    {...form.register('buyerOrgUrl')}
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="mandateBlurb">Mandate in One Line (≤140 chars, Optional)</Label>
              <Textarea
                id="mandateBlurb"
                placeholder="Brief description of your mandate or focus"
                maxLength={140}
                {...form.register('mandateBlurb')}
              />
            </div>
          </div>
        );

      case 'businessOwner':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ownerIntent">Why are you here? (≤140 chars) *</Label>
              <Textarea
                id="ownerIntent"
                placeholder="e.g., Valuation, Open to intros"
                maxLength={140}
                {...form.register('ownerIntent')}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Brief explanation of what you're looking for.
              </p>
            </div>

            <div>
              <Label htmlFor="ownerTimeline">Timeline (Optional)</Label>
              <Select onValueChange={(value) => setValue('ownerTimeline', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timeline" />
                </SelectTrigger>
                <SelectContent>
                  {OWNER_TIMELINE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'individual':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="fundingSource">Funding Source *</Label>
              <Select onValueChange={(value) => setValue('fundingSource', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select funding source" />
                </SelectTrigger>
                <SelectContent>
                  {INDIVIDUAL_FUNDING_SOURCE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="usesBankFinance">Will you use SBA/bank financing? *</Label>
              <Select onValueChange={(value) => setValue('usesBankFinance', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select yes, no, or not sure" />
                </SelectTrigger>
                <SelectContent>
                  {USES_BANK_FINANCE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="maxEquityTodayBand">Max Equity You Can Commit Today (Optional)</Label>
              <Select onValueChange={(value) => setValue('maxEquityTodayBand', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select equity range" />
                </SelectTrigger>
                <SelectContent>
                  {MAX_EQUITY_TODAY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="idealTarget">Ideal Target</Label>
              <Textarea
                id="idealTarget"
                placeholder="Describe your ideal acquisition target"
                {...form.register('idealTarget')}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const steps = [
    'Account Information',
    'Personal Details', 
    'Buyer Profile',
    'Investment Criteria'
  ];

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Work Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                {...form.register('email')}
                className={errors.email ? 'border-destructive' : ''}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Please use your work email address (personal emails are allowed)
              </p>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a secure password"
                {...form.register('password')}
                className={errors.password ? 'border-destructive' : ''}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  {...form.register('firstName')}
                  className={errors.firstName ? 'border-destructive' : ''}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  placeholder="Smith"
                  {...form.register('lastName')}
                  className={errors.lastName ? 'border-destructive' : ''}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                placeholder="Acme Capital Partners"
                {...form.register('company')}
                className={errors.company ? 'border-destructive' : ''}
              />
              {errors.company && (
                <p className="text-sm text-destructive">{errors.company.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="jobTitle">Job Title (Optional)</Label>
              <Input
                id="jobTitle"
                placeholder="Partner, Managing Director, etc."
                {...form.register('jobTitle')}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Helps with quick triage: Analyst/Associate vs Partner/M&A Director
              </p>
            </div>

            <div>
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                placeholder="+1 (555) 123-4567"
                {...form.register('phone_number')}
              />
            </div>

            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://company.com"
                {...form.register('website')}
              />
            </div>

            <div>
              <Label htmlFor="linkedinProfile">LinkedIn Profile</Label>
              <Input
                id="linkedinProfile"
                type="url"
                placeholder="https://linkedin.com/in/yourprofile"
                {...form.register('linkedinProfile')}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="buyerType">Buyer Type *</Label>
              <Select onValueChange={(value) => setValue('buyerType', value as SignupFormData['buyerType'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your buyer type" />
                </SelectTrigger>
                <SelectContent>
                  {BUYER_TYPE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.buyerType && (
                <p className="text-sm text-destructive">{errors.buyerType.message}</p>
              )}
            </div>

            {buyerType && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">
                  {BUYER_TYPE_OPTIONS.find(opt => opt.value === buyerType)?.label} Details
                </h3>
                {renderBuyerSpecificFields()}
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Complete your profile with investment criteria and target preferences. 
                All fields in this section are optional but help us show you more relevant deals.
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="idealTargetDescription">Ideal Target Description</Label>
              <Textarea
                id="idealTargetDescription"
                placeholder="Describe your ideal acquisition target..."
                rows={3}
                {...form.register('idealTargetDescription')}
              />
            </div>

            <div>
              <Label htmlFor="specificBusinessSearch">Specific Business Requirements</Label>
              <Textarea
                id="specificBusinessSearch"
                placeholder="1–2 must-haves only (e.g., non-union, 60% recurring)"
                rows={2}
                {...form.register('specificBusinessSearch')}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Hint: "1–2 must-haves only (e.g., non-union, 60% recurring)."
              </p>
            </div>

            {/* New Step 4 fields */}
            {(() => {
              console.log('Step 4 fields rendering...');
              console.log('DEAL_INTENT_OPTIONS:', DEAL_INTENT_OPTIONS);
              return null;
            })()}
            
            <div>
              <Label htmlFor="dealIntent">Deal Intent</Label>
              <div className="space-y-2">
                {DEAL_INTENT_OPTIONS.map(option => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`dealIntent-${option.value}`}
                      value={option.value}
                      {...form.register('dealIntent')}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`dealIntent-${option.value}`} className="text-sm font-normal">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                What type of deals are you primarily focused on pursuing?
              </p>
            </div>

            <div>
              <Label htmlFor="exclusions">Hard Exclusions</Label>
              <Textarea
                id="exclusions"
                placeholder="e.g., unionized, DTC, heavy CapEx"
                rows={2}
                value={watch('exclusions') ? watch('exclusions')?.join(', ') : ''}
                onChange={(e) => setValue('exclusions', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
              />
              <p className="text-sm text-muted-foreground mt-1">
                e.g., unionized, DTC, heavy CapEx.
              </p>
            </div>

            <div>
              <Label htmlFor="includeKeywords">Keywords (optional)</Label>
              <Textarea
                id="includeKeywords"
                placeholder="e.g., route-based, B2B services"
                rows={2}
                value={watch('includeKeywords') ? watch('includeKeywords')?.join(', ') : ''}
                onChange={(e) => {
                  const keywords = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                  setValue('includeKeywords', keywords.slice(0, 5)); // max 5
                }}
              />
              <p className="text-sm text-muted-foreground mt-1">
                2–5 keywords you care about (e.g., 'route-based', 'B2B services').
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return watch('email') && watch('password');
      case 1:
        return watch('firstName') && watch('lastName') && watch('company');
      case 2:
        return watch('buyerType');
      default:
        return true;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Your Account</CardTitle>
        <CardDescription>
          Step {currentStep + 1} of {steps.length}: {steps[currentStep]}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {renderStep()}

          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              Back
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceed()}
              >
                Continue
              </Button>
            ) : (
              <Button type="submit" disabled={isLoading || !canProceed()}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
