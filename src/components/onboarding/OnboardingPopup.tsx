import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Search, MessageCircle, Users, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingPopupProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

const OnboardingPopup = ({ isOpen, onClose, userEmail }: OnboardingPopupProps) => {
  const [currentStep, setCurrentStep] = useState(1);

  const handleClose = async () => {
    // Mark onboarding as completed
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('email', userEmail);
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

  const handleSkip = () => {
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 bg-background border border-border/50 shadow-2xl">
        <div className="relative">
          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-4 top-4 z-10 h-8 w-8 p-0 hover:bg-muted/50"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Step indicator */}
          <div className="flex justify-center pt-6 pb-2">
            <div className="flex space-x-2">
              {[1, 2].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    step <= currentStep 
                      ? 'bg-primary' 
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-8 pb-8">
            {currentStep === 1 ? (
              <div className="text-center space-y-6">
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold text-foreground">
                    Welcome to the Marketplace
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Discover curated, founder-led businesses ready for acquisition. 
                    Every seller is vetted and genuinely committed to a transaction.
                  </p>
                </div>

                <Card className="p-6 bg-muted/30 border-border/50">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Search className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-medium text-foreground">Browse Premium Listings</h3>
                        <p className="text-sm text-muted-foreground">
                          Explore verified businesses with real financials and seller intent
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-medium text-foreground">Request Connections</h3>
                        <p className="text-sm text-muted-foreground">
                          Connect directly with sellers when you find interesting opportunities
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="text-center space-y-6">
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold text-foreground">
                    Success-Based Pricing
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    You only pay when a deal closes. No platform fees, no exclusivity, 
                    no retainers — just results.
                  </p>
                </div>

                <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2 text-primary font-medium">
                      <span className="text-2xl">🔒</span>
                      <span>Curated & Selective</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      We're in beta, onboarding new sellers weekly based on real readiness, 
                      not scraped lists.
                    </p>
                    
                    <div className="pt-2">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <MessageCircle className="h-4 w-4" />
                        <span>Questions? Use our feedback widget anytime</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center mt-8">
              <Button 
                variant="ghost" 
                onClick={handleSkip}
                className="text-muted-foreground hover:text-foreground"
              >
                Skip
              </Button>
              
              <Button 
                onClick={handleNext}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90"
              >
                {currentStep === 2 ? 'Start Exploring' : 'Next'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingPopup;