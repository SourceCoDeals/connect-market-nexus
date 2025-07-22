
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
        return;
      }

      if (!data || data.length === 0) {
        console.error('❌ No data returned from onboarding update');
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update your profile. Please try again.",
        });
        return;
      }

      console.log('✅ Onboarding completion successful:', data[0]);
      toast({
        title: "Welcome to SourceCo!",
        description: "Your onboarding is complete. You can now explore all listings.",
      });
      
      onClose();
    } catch (error) {
      console.error('💥 Exception during onboarding completion:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Something went wrong. Please try again or contact support.",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleNext = () => {
    if (currentStep < 2) {
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
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 bg-white border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.25)] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200/50">
          <div className="flex justify-between items-center px-8 py-6">
            <div className="flex space-x-2">
              {[1, 2].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 w-16 rounded-full transition-all duration-500 ${
                    step <= currentStep 
                      ? 'bg-slate-900' 
                      : 'bg-slate-300'
                  }`}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-slate-200/50 text-slate-500 hover:text-slate-700 rounded-full"
              onClick={handleClose}
              disabled={isCompleting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white">
          {currentStep === 1 ? (
            <div className="px-8 py-8 space-y-8">
              <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  Welcome to SourceCo
                </h1>
                <p className="text-lg text-slate-600 max-w-md mx-auto leading-relaxed">
                  Your curated marketplace for founder-led business acquisitions
                </p>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-200/30">
                  <div className="flex items-start gap-4">
                    <div className="text-2xl">🔍</div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">Browse Premium Listings</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Explore verified businesses with real financials and genuine seller intent. Every listing is hand-curated.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-200/30">
                  <div className="flex items-start gap-4">
                    <div className="text-2xl">🤝</div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">Request Direct Connections</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Connect with sellers when opportunities match your criteria. Every seller must approve buyer outreach.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-slate-100 to-slate-50 rounded-2xl p-6 border border-slate-200/50">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">💬</span>
                  <span className="font-medium text-slate-700">Questions? Use our feedback widget anytime</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-8 py-8 space-y-8">
              <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  Success-Based Pricing
                </h1>
                <p className="text-lg text-slate-600 max-w-md mx-auto leading-relaxed">
                  You only pay when a deal closes. No platform fees, no exclusivity, no retainers — just results.
                </p>
              </div>

              <div className="bg-gradient-to-br from-slate-900/5 to-slate-900/10 rounded-2xl p-8 border border-slate-900/10">
                <div className="text-center space-y-6">
                  <div className="text-4xl">🔒</div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">Curated & Selective</h3>
                    <p className="text-slate-600 leading-relaxed">
                      We're in beta, onboarding new sellers weekly based on real readiness, not scraped lists.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200/30 text-center">
                  <div className="text-lg mb-2">🚫</div>
                  <p className="text-sm font-medium text-slate-700">No Platform Fees</p>
                </div>
                <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200/30 text-center">
                  <div className="text-lg mb-2">📈</div>
                  <p className="text-sm font-medium text-slate-700">Success-Based Only</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="bg-slate-50/30 border-t border-slate-200/50 px-8 py-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                {currentStep > 1 && (
                  <Button 
                    variant="ghost" 
                    onClick={handleBack}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    disabled={isCompleting}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  onClick={handleSkip}
                  className="text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  disabled={isCompleting}
                >
                  Skip
                </Button>
              </div>
              
              <Button 
                onClick={handleNext}
                className="px-8 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors"
                disabled={isCompleting}
              >
                {isCompleting ? 'Completing...' : currentStep === 2 ? 'Start Exploring' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingPopup;
