import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signupFormSchema, type SignupFormData, SIGNUP_FLOW_STATES } from '../types/auth.types';
import { useProtectedAuth } from '../hooks/useProtectedAuth';
import { Loader2 } from 'lucide-react';

export const ProtectedSignupForm: React.FC = () => {
  const { signup, signupFlowState, transitionSignupState } = useProtectedAuth();
  
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

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Your Account</CardTitle>
        <CardDescription>
          Join our marketplace to connect with business opportunities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
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
              <Label htmlFor="lastName">Last Name</Label>
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
            <Label htmlFor="email">Email</Label>
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
            <Label htmlFor="password">Password</Label>
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
            <Label htmlFor="company">Company</Label>
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
            <Label htmlFor="buyerType">Buyer Type</Label>
            <Select onValueChange={(value) => setValue('buyerType', value as any)} disabled={isSigningUp}>
              <SelectTrigger>
                <SelectValue placeholder="Select buyer type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corporate">Corporate</SelectItem>
                <SelectItem value="privateEquity">Private Equity</SelectItem>
                <SelectItem value="familyOffice">Family Office</SelectItem>
                <SelectItem value="searchFund">Search Fund</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
              </SelectContent>
            </Select>
            {errors.buyerType && (
              <p className="text-sm text-destructive mt-1">{errors.buyerType.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="website">Website (Optional)</Label>
            <Input
              id="website"
              {...register('website')}
              disabled={isSigningUp}
            />
            {errors.website && (
              <p className="text-sm text-destructive mt-1">{errors.website.message}</p>
            )}
          </div>

          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="dealAlerts"
                className="mt-1"
                defaultChecked={true}
              />
              <div className="space-y-1">
                <Label htmlFor="dealAlerts" className="text-sm font-medium">
                  📧 Get notified about new deals (Recommended)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Be the first to know when new business opportunities match your interests. You can set up specific criteria after signup.
                </p>
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSigningUp}
          >
            {isSigningUp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Create Account & Get Deal Alerts'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};