
import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface OnboardingPopupProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const OnboardingPopup = ({ isOpen, onClose, userId }: OnboardingPopupProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isCompleting, setIsCompleting] = useState(false);

  const handleClose = async () => {
    console.log('🎯 Starting onboarding completion for user:', userId);
    setIsCompleting(true);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true } as any)
        .eq('id', userId)
        .select('onboarding_completed');

      if (error) {
        console.error('❌ Error updating onboarding status:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to complete onboarding. Please try again.",
        });
        setIsCompleting(false);
        return;
      }

      if (!data || data.length === 0) {
        console.error('❌ No data returned from onboarding update');
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update your profile. Please try again.",
        });
        setIsCompleting(false);
        return;
      }

      console.log('✅ Onboarding completion successful:', data[0]);
      
      // Close immediately after successful update
      onClose();
      
      // Show success message after popup closes
      setTimeout(() => {
        toast({
          title: "Welcome to SourceCo!",
          description: "Your onboarding is complete. You can now explore all listings.",
        });
      }, 100);
      
    } catch (error) {
      console.error('💥 Exception during onboarding completion:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Something went wrong. Please try again or contact support.",
      });
      setIsCompleting(false);
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal={true}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 bg-white border-none shadow-[0_20px_40px_-8px_rgba(0,0,0,0.2)] overflow-hidden">
        {/* Header */}
        <div className="relative bg-white border-b border-slate-100">
          <div className="flex justify-between items-center px-6 py-4">
            <div className="flex space-x-1">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-1 w-12 rounded-full transition-all duration-300 ${
                    step <= currentStep 
                      ? 'bg-slate-900' 
                      : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full"
              onClick={handleClose}
              disabled={isCompleting}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white px-6 py-6">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-xl font-semibold text-slate-900">
                  Curated Quality
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Every seller must approve buyer outreach. We only introduce buyers once there's alignment and real seller intent.
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    <span className="text-xs font-medium text-green-700 uppercase tracking-wide">FOR SALE</span>
                  </div>
                  <p className="text-sm text-slate-700">
                    All our for sale listings have verified financials and a complete data room available.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">OFF MARKET</span>
                  </div>
                  <p className="text-sm text-slate-700">
                    These are businesses whose owners aren't publicly advertising their intent to sell but are open to entertaining offers from interested buyers.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-xl font-semibold text-slate-900">
                  Curated Beta
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  This is a curated beta. We're rolling out access selectively while onboarding new sellers weekly.
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <p className="text-sm text-slate-700">
                  Sellers don't pay to be here. That's how we earn trust early and why the deals are higher quality and earlier-stage than what's on the market.
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <p className="text-sm text-slate-700">
                  New founder-led deals are added weekly based on real seller readiness.
                </p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-xl font-semibold text-slate-900">
                  Pricing Model
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  You'll only pay a success fee if a deal closes. It's based on a modified Layman scale.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                  <p className="text-xs font-medium text-slate-700">No Platform Fees</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                  <p className="text-xs font-medium text-slate-700">No Exclusivity</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                  <p className="text-xs font-medium text-slate-700">No Retainers</p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-xl font-semibold text-slate-900">
                  Take your next step
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Use the request access to get the answers you need to move forward on any businesses you're interested in.
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <p className="text-sm text-slate-700">
                  Any business you Save or take a next step on will be saved in your Buyer Dashboard for future reference!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {currentStep > 1 && (
                <Button 
                  variant="ghost" 
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 h-8 px-3 text-sm"
                  disabled={isCompleting}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
              )}
            </div>
            
            <Button 
              onClick={handleNext}
              className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors h-8"
              disabled={isCompleting}
            >
              {isCompleting ? 'Completing...' : currentStep === 4 ? 'Start Exploring Off-Market Deals' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingPopup;
