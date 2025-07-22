import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingPopupProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const OnboardingPopup = ({ isOpen, onClose, userId }: OnboardingPopupProps) => {
  const [currentStep, setCurrentStep] = useState(1);

  const handleClose = async () => {
    // Mark onboarding as completed
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true } as any)
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating onboarding status:', error);
    }
    onClose();
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[580px] p-0 gap-0 bg-background border-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden">
        <div className="relative bg-gradient-to-br from-background to-muted/20">
          {/* Header with close button */}
          <div className="flex justify-between items-center p-6 pb-0">
            <div className="flex space-x-1">
              {[1, 2].map((step) => (
                <div
                  key={step}
                  className={`h-1 w-12 rounded-full transition-all duration-300 ${
                    step <= currentStep 
                      ? 'bg-primary' 
                      : 'bg-muted-foreground/20'
                  }`}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="px-8 pb-8 pt-6">
            {currentStep === 1 ? (
              <div className="space-y-8">
                <div className="text-center space-y-4">
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Welcome to SourceCo
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Your curated marketplace for founder-led business acquisitions
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-6 border border-border/50">
                    <div className="flex items-start gap-4">
                      <div className="text-2xl">🔍</div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Browse Premium Listings</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Explore verified businesses with real financials and genuine seller intent. Every listing is hand-curated.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-6 border border-border/50">
                    <div className="flex items-start gap-4">
                      <div className="text-2xl">🤝</div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Request Direct Connections</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Connect with sellers when opportunities match your criteria. Every seller must approve buyer outreach.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-2xl p-6 border border-border/30">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">💬</span>
                    <span className="font-medium text-muted-foreground">Questions? Use our feedback widget anytime</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="text-center space-y-4">
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Success-Based Pricing
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                    You only pay when a deal closes. No platform fees, no exclusivity, no retainers — just results.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-8 border border-primary/20">
                  <div className="text-center space-y-6">
                    <div className="text-4xl">🔒</div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-3">Curated & Selective</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        We're in beta, onboarding new sellers weekly based on real readiness, not scraped lists.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/50 text-center">
                    <div className="text-lg mb-2">🚫</div>
                    <p className="text-sm font-medium text-muted-foreground">No Platform Fees</p>
                  </div>
                  <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/50 text-center">
                    <div className="text-lg mb-2">📈</div>
                    <p className="text-sm font-medium text-muted-foreground">Success-Based Only</p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center mt-10">
              <div className="flex items-center gap-3">
                {currentStep > 1 && (
                  <Button 
                    variant="ghost" 
                    onClick={handleBack}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  onClick={handleSkip}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Skip
                </Button>
              </div>
              
              <Button 
                onClick={handleNext}
                className="px-8 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg"
              >
                {currentStep === 2 ? 'Start Exploring' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingPopup;