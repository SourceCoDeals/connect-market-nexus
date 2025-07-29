import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, ArrowLeft, CheckCircle, Users, TrendingUp, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSignupAnalytics } from '@/hooks/use-signup-analytics';

interface EnhancedOnboardingPopupProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const EnhancedOnboardingPopup = ({ isOpen, onClose, userId }: EnhancedOnboardingPopupProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isCompleting, setIsCompleting] = useState(false);
  const [stepStartTime, setStepStartTime] = useState(Date.now());
  const { trackStep, trackCompletion } = useSignupAnalytics(userId, '');

  const steps = [
    {
      id: 1,
      title: "Quality & Curation",
      icon: Shield,
      content: {
        subtitle: "Every deal is vetted and verified",
        points: [
          "Verified financials and complete data rooms",
          "Seller-approved buyer introductions only",
          "No public listings - exclusive access"
        ]
      }
    },
    {
      id: 2,
      title: "Market Access",
      icon: TrendingUp,
      content: {
        subtitle: "Early access to off-market opportunities",
        points: [
          "New founder-led deals added weekly",
          "Off-market opportunities before they go public",
          "Direct seller relationships"
        ]
      }
    },
    {
      id: 3,
      title: "No-Risk Model",
      icon: CheckCircle,
      content: {
        subtitle: "Success-based pricing only",
        points: [
          "No platform fees or retainers",
          "No exclusivity requirements",
          "Modified Lehman scale on close only"
        ]
      }
    },
    {
      id: 4,
      title: "Your Next Steps",
      icon: Users,
      content: {
        subtitle: "Start exploring opportunities",
        points: [
          "Save interesting deals to your dashboard",
          "Request access for detailed information",
          "Get introduced to qualified sellers"
        ]
      }
    }
  ];

  useEffect(() => {
    setStepStartTime(Date.now());
  }, [currentStep]);

  const handleStepChange = async (newStep: number) => {
    const timeSpent = Math.round((Date.now() - stepStartTime) / 1000);
    
    // Track the current step completion
    await trackStep({
      stepName: `onboarding_step_${currentStep}`,
      stepOrder: currentStep,
      timeSpent
    });

    setCurrentStep(newStep);
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    
    try {
      const timeSpent = Math.round((Date.now() - stepStartTime) / 1000);
      
      // Track final step
      await trackStep({
        stepName: `onboarding_step_${currentStep}`,
        stepOrder: currentStep,
        timeSpent
      });

      // Track completion
      await trackCompletion();

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Update localStorage
      localStorage.setItem('onboarding_completed', 'true');
      
      toast({
        title: "Welcome to SourceCo!",
        description: "You're all set to explore exclusive opportunities.",
      });
      
      onClose();
      
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to complete onboarding. Please try again.",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      handleStepChange(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      handleStepChange(currentStep - 1);
    }
  };

  const currentStepData = steps[currentStep - 1];
  const IconComponent = currentStepData.icon;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal={true}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 bg-white border-none shadow-[0_20px_40px_-8px_rgba(0,0,0,0.15)] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-slate-600 font-medium">
                Step {currentStep} of {steps.length}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full"
                onClick={onClose}
                disabled={isCompleting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Progress value={(currentStep / steps.length) * 100} className="h-2" />
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
              <IconComponent className="h-8 w-8 text-slate-700" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              {currentStepData.title}
            </h1>
            <p className="text-sm text-slate-600">
              {currentStepData.content.subtitle}
            </p>
          </div>

          <div className="space-y-3">
            {currentStepData.content.points.map((point, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-700">{point}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-slate-50 border-t border-slate-100 p-6">
          <div className="flex justify-between items-center">
            <div>
              {currentStep > 1 && (
                <Button 
                  variant="ghost" 
                  onClick={handleBack}
                  className="flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 h-9 px-4"
                  disabled={isCompleting}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
            </div>
            
            <Button 
              onClick={handleNext}
              className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors h-9"
              disabled={isCompleting}
            >
              {isCompleting ? 'Completing...' : currentStep === 4 ? 'Start Exploring' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedOnboardingPopup;