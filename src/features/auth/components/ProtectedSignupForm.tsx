import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { signupFormSchema, type SignupFormData, SIGNUP_FLOW_STATES } from '../types/auth.types';
import { useProtectedAuth } from '../hooks/useProtectedAuth';
import { Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BuyerType } from '@/types';

export const ProtectedSignupForm: React.FC = () => {
  const { signup, signupFlowState, transitionSignupState } = useProtectedAuth();
  const [currentStep, setCurrentStep] = useState(1);
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupFormSchema)
  });

  const isSigningUp = signupFlowState === SIGNUP_FLOW_STATES.SIGNING_UP;
  const watchedBuyerType = watch('buyerType');
  const watchedIsFunded = watch('isFunded');

  const onSubmit = async (data: SignupFormData) => {
    try {
      transitionSignupState(SIGNUP_FLOW_STATES.SIGNING_UP);
      
      const { password, ...userData } = data;
      await signup(userData, password);
      
      transitionSignupState(SIGNUP_FLOW_STATES.SUCCESS);
    } catch (error) {
      transitionSignupState(SIGNUP_FLOW_STATES.ERROR);
      console.error('Signup error:', error);
    }
  };

  const renderBuyerSpecificFields = () => {
    if (!watchedBuyerType) return null;

    switch (watchedBuyerType) {
      case 'corporate':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Corporate Information</h3>
            <div>
              <Label htmlFor="estimatedRevenue">Estimated Annual Revenue</Label>
              <Select onValueChange={(value) => setValue('estimatedRevenue', value)} disabled={isSigningUp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select revenue range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="under-1m">Under $1M</SelectItem>
                  <SelectItem value="1m-5m">$1M - $5M</SelectItem>
                  <SelectItem value="5m-10m">$5M - $10M</SelectItem>
                  <SelectItem value="10m-25m">$10M - $25M</SelectItem>
                  <SelectItem value="25m-50m">$25M - $50M</SelectItem>
                  <SelectItem value="50m-100m">$50M - $100M</SelectItem>
                  <SelectItem value="over-100m">Over $100M</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'privateEquity':
      case 'familyOffice':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              {watchedBuyerType === 'privateEquity' ? 'Private Equity' : 'Family Office'} Information
            </h3>
            <div>
              <Label htmlFor="fundSize">Fund Size</Label>
              <Select onValueChange={(value) => setValue('fundSize', value)} disabled={isSigningUp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select fund size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="under-10m">Under $10M</SelectItem>
                  <SelectItem value="10m-50m">$10M - $50M</SelectItem>
                  <SelectItem value="50m-100m">$50M - $100M</SelectItem>
                  <SelectItem value="100m-500m">$100M - $500M</SelectItem>
                  <SelectItem value="500m-1b">$500M - $1B</SelectItem>
                  <SelectItem value="over-1b">Over $1B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="investmentSize">Typical Investment Size</Label>
              <Select onValueChange={(value) => setValue('investmentSize', value)} disabled={isSigningUp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select investment size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="under-1m">Under $1M</SelectItem>
                  <SelectItem value="1m-5m">$1M - $5M</SelectItem>
                  <SelectItem value="5m-10m">$5M - $10M</SelectItem>
                  <SelectItem value="10m-25m">$10M - $25M</SelectItem>
                  <SelectItem value="25m-50m">$25M - $50M</SelectItem>
                  <SelectItem value="over-50m">Over $50M</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="aum">Assets Under Management (AUM)</Label>
              <Select onValueChange={(value) => setValue('aum', value)} disabled={isSigningUp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select AUM range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="under-50m">Under $50M</SelectItem>
                  <SelectItem value="50m-100m">$50M - $100M</SelectItem>
                  <SelectItem value="100m-500m">$100M - $500M</SelectItem>
                  <SelectItem value="500m-1b">$500M - $1B</SelectItem>
                  <SelectItem value="1b-5b">$1B - $5B</SelectItem>
                  <SelectItem value="over-5b">Over $5B</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'searchFund':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Search Fund Information</h3>
            <div>
              <Label htmlFor="isFunded">Are you currently funded? *</Label>
              <Select onValueChange={(value) => setValue('isFunded', value)} disabled={isSigningUp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select funding status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes, I am funded</SelectItem>
                  <SelectItem value="no">No, I am self-funded</SelectItem>
                  <SelectItem value="seeking">Currently seeking funding</SelectItem>
                </SelectContent>
              </Select>
              {errors.isFunded && (
                <p className="text-sm text-destructive mt-1">{errors.isFunded.message}</p>
              )}
            </div>
            
            {watchedIsFunded === 'yes' && (
              <div>
                <Label htmlFor="fundedBy">Who is funding your search? *</Label>
                <Input
                  id="fundedBy"
                  {...register('fundedBy')}
                  placeholder="e.g., ABC Capital, John Smith Family"
                  disabled={isSigningUp}
                />
                {errors.fundedBy && (
                  <p className="text-sm text-destructive mt-1">{errors.fundedBy.message}</p>
                )}
              </div>
            )}
            
            <div>
              <Label htmlFor="targetCompanySize">Target Company Size (Revenue) *</Label>
              <Select onValueChange={(value) => setValue('targetCompanySize', value)} disabled={isSigningUp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target company size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="under-1m">Under $1M</SelectItem>
                  <SelectItem value="1m-5m">$1M - $5M</SelectItem>
                  <SelectItem value="5m-10m">$5M - $10M</SelectItem>
                  <SelectItem value="10m-25m">$10M - $25M</SelectItem>
                  <SelectItem value="25m-50m">$25M - $50M</SelectItem>
                  <SelectItem value="over-50m">Over $50M</SelectItem>
                </SelectContent>
              </Select>
              {errors.targetCompanySize && (
                <p className="text-sm text-destructive mt-1">{errors.targetCompanySize.message}</p>
              )}
            </div>
          </div>
        );

      case 'individual':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Individual Buyer Information</h3>
            <div>
              <Label htmlFor="fundingSource">Primary Funding Source *</Label>
              <Select onValueChange={(value) => setValue('fundingSource', value)} disabled={isSigningUp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select funding source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal-savings">Personal Savings</SelectItem>
                  <SelectItem value="retirement-funds">Retirement Funds (401k/IRA)</SelectItem>
                  <SelectItem value="family-funds">Family/Friends Investment</SelectItem>
                  <SelectItem value="angel-investors">Angel Investors</SelectItem>
                  <SelectItem value="bank-loan">Bank Financing</SelectItem>
                  <SelectItem value="sba-loan">SBA Loan</SelectItem>
                  <SelectItem value="seller-financing">Seller Financing</SelectItem>
                  <SelectItem value="combination">Combination of Sources</SelectItem>
                </SelectContent>
              </Select>
              {errors.fundingSource && (
                <p className="text-sm text-destructive mt-1">{errors.fundingSource.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="needsLoan">Do you need SBA or bank financing? *</Label>
              <Select onValueChange={(value) => setValue('needsLoan', value)} disabled={isSigningUp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select loan requirement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes, I need financing</SelectItem>
                  <SelectItem value="no">No, all cash purchase</SelectItem>
                  <SelectItem value="maybe">Possibly, depending on the deal</SelectItem>
                </SelectContent>
              </Select>
              {errors.needsLoan && (
                <p className="text-sm text-destructive mt-1">{errors.needsLoan.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="idealTarget">Describe your ideal business target *</Label>
              <Textarea
                id="idealTarget"
                {...register('idealTarget')}
                placeholder="e.g., Small manufacturing company, service business, retail operation..."
                disabled={isSigningUp}
                rows={3}
              />
              {errors.idealTarget && (
                <p className="text-sm text-destructive mt-1">{errors.idealTarget.message}</p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderStep = () => {
    if (currentStep === 1) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                {...register('firstName')}
                disabled={isSigningUp}
              />
              {errors.firstName && (
                <p className="text-sm text-destructive mt-1">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                {...register('lastName')}
                disabled={isSigningUp}
              />
              {errors.lastName && (
                <p className="text-sm text-destructive mt-1">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              disabled={isSigningUp}
            />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              {...register('password')}
              disabled={isSigningUp}
            />
            {errors.password && (
              <p className="text-sm text-destructive mt-1">{errors.password.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="company">Company/Organization *</Label>
            <Input
              id="company"
              {...register('company')}
              disabled={isSigningUp}
            />
            {errors.company && (
              <p className="text-sm text-destructive mt-1">{errors.company.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="buyerType">What type of buyer are you? *</Label>
            <Select onValueChange={(value) => setValue('buyerType', value as any)} disabled={isSigningUp}>
              <SelectTrigger>
                <SelectValue placeholder="Select buyer type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corporate">Corporate Buyer</SelectItem>
                <SelectItem value="privateEquity">Private Equity</SelectItem>
                <SelectItem value="familyOffice">Family Office</SelectItem>
                <SelectItem value="searchFund">Search Fund</SelectItem>
                <SelectItem value="individual">Individual Buyer</SelectItem>
              </SelectContent>
            </Select>
            {errors.buyerType && (
              <p className="text-sm text-destructive mt-1">{errors.buyerType.message}</p>
            )}
          </div>

          {watchedBuyerType && (
            <Button 
              type="button" 
              onClick={() => setCurrentStep(2)}
              className="w-full"
              disabled={isSigningUp}
            >
              Continue to Profile Details
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Contact Information</h3>
          <div>
            <Label htmlFor="website">Company Website</Label>
            <Input
              id="website"
              {...register('website')}
              placeholder="https://yourcompany.com"
              disabled={isSigningUp}
            />
            {errors.website && (
              <p className="text-sm text-destructive mt-1">{errors.website.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input
              id="phone_number"
              {...register('phone_number')}
              placeholder="+1 (555) 123-4567"
              disabled={isSigningUp}
            />
          </div>

          <div>
            <Label htmlFor="linkedinProfile">LinkedIn Profile</Label>
            <Input
              id="linkedinProfile"
              {...register('linkedinProfile')}
              placeholder="https://linkedin.com/in/yourname"
              disabled={isSigningUp}
            />
            {errors.linkedinProfile && (
              <p className="text-sm text-destructive mt-1">{errors.linkedinProfile.message}</p>
            )}
          </div>
        </div>

        {/* Investment Criteria */}
        {watchedBuyerType !== 'privateEquity' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Investment Criteria</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="revenueRangeMin">Min Revenue ($)</Label>
                <Input
                  id="revenueRangeMin"
                  type="number"
                  {...register('revenueRangeMin', { valueAsNumber: true })}
                  placeholder="1000000"
                  disabled={isSigningUp}
                />
              </div>
              <div>
                <Label htmlFor="revenueRangeMax">Max Revenue ($)</Label>
                <Input
                  id="revenueRangeMax"
                  type="number"
                  {...register('revenueRangeMax', { valueAsNumber: true })}
                  placeholder="10000000"
                  disabled={isSigningUp}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="targetLocations">Target Locations</Label>
              <Input
                id="targetLocations"
                {...register('targetLocations')}
                placeholder="e.g., Northeast US, California, Remote OK"
                disabled={isSigningUp}
              />
            </div>

            <div>
              <Label htmlFor="idealTargetDescription">Ideal Target Description</Label>
              <Textarea
                id="idealTargetDescription"
                {...register('idealTargetDescription')}
                placeholder="Describe the type of business you're looking to acquire..."
                disabled={isSigningUp}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="specificBusinessSearch">Specific Business/Industry Search</Label>
              <Textarea
                id="specificBusinessSearch"
                {...register('specificBusinessSearch')}
                placeholder="Any specific businesses, industries, or keywords you're searching for..."
                disabled={isSigningUp}
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Buyer-Specific Fields */}
        {renderBuyerSpecificFields()}

        {/* Navigation Buttons */}
        <div className="flex gap-4">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => setCurrentStep(1)}
            className="flex-1"
            disabled={isSigningUp}
          >
            Back
          </Button>
          <Button 
            type="submit" 
            className="flex-1" 
            disabled={isSigningUp}
          >
            {isSigningUp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Your Account</CardTitle>
        <CardDescription>
          Join our marketplace to connect with business opportunities
        </CardDescription>
        
        {/* Progress Indicator */}
        <div className="flex items-center space-x-2 mt-4">
          <div className={`h-2 flex-1 rounded ${currentStep >= 1 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-2 flex-1 rounded ${currentStep >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        </div>
        <p className="text-sm text-muted-foreground">
          Step {currentStep} of 2: {currentStep === 1 ? 'Basic Information' : 'Profile Details'}
        </p>
      </CardHeader>
      <CardContent>
        {currentStep === 2 && (
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Please complete your profile to help us match you with relevant opportunities. 
              Fields marked with * are required for {watchedBuyerType} buyers.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {renderStep()}
        </form>
      </CardContent>
    </Card>
  );
};