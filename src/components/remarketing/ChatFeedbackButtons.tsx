/**
 * Chat Feedback Buttons
 * Thumbs up/down feedback for chat messages
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ThumbsUp, ThumbsDown, MessageSquareWarning } from 'lucide-react';
import { submitFeedback } from '@/integrations/supabase/chat-analytics';
import { useToast } from '@/hooks/use-toast';

interface ChatFeedbackButtonsProps {
  conversationId: string;
  messageIndex: number;
  messageContent: string;
  className?: string;
}

export function ChatFeedbackButtons({
  conversationId,
  messageIndex,
  messageContent,
  className,
}: ChatFeedbackButtonsProps) {
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);
  const [issueType, setIssueType] = useState<string>('');
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleRating = async (newRating: 1 | -1) => {
    if (rating === newRating) return; // Already rated

    setRating(newRating);

    // Submit simple rating
    const { success } = await submitFeedback({
      conversationId,
      messageIndex,
      rating: newRating,
    });

    if (success) {
      toast({
        title: newRating === 1 ? 'Thanks!' : 'Feedback received',
        description: newRating === 1
          ? 'Glad this was helpful!'
          : 'Thanks for letting us know. Want to tell us more?',
        duration: 3000,
      });

      // If thumbs down, show detailed feedback option
      if (newRating === -1) {
        setShowDetailedFeedback(true);
      }
    }
  };

  const handleDetailedFeedback = async () => {
    if (!rating || isSubmitting) return;

    setIsSubmitting(true);

    const { success } = await submitFeedback({
      conversationId,
      messageIndex,
      rating,
      issueType: issueType as any,
      feedbackText: feedbackText.trim() || undefined,
    });

    setIsSubmitting(false);

    if (success) {
      toast({
        title: 'Feedback submitted',
        description: 'Thank you for helping us improve!',
        duration: 3000,
      });
      setShowDetailedFeedback(false);
      setFeedbackText('');
      setIssueType('');
    } else {
      toast({
        title: 'Error',
        description: 'Failed to submit feedback. Please try again.',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Thumbs Up */}
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 p-0 ${rating === 1 ? 'text-green-600' : 'text-muted-foreground'}`}
        onClick={() => handleRating(1)}
        disabled={rating !== null}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>

      {/* Thumbs Down */}
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 p-0 ${rating === -1 ? 'text-red-600' : 'text-muted-foreground'}`}
        onClick={() => handleRating(-1)}
        disabled={rating !== null}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>

      {/* Detailed Feedback (only show after thumbs down or via popover) */}
      {rating === -1 && (
        <Popover open={showDetailedFeedback} onOpenChange={setShowDetailedFeedback}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
            >
              <MessageSquareWarning className="h-3.5 w-3.5 mr-1" />
              Tell us more
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">What went wrong?</h4>
                <RadioGroup value={issueType} onValueChange={setIssueType}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="incorrect" id="incorrect" />
                    <Label htmlFor="incorrect" className="text-sm font-normal">
                      Incorrect information
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="incomplete" id="incomplete" />
                    <Label htmlFor="incomplete" className="text-sm font-normal">
                      Incomplete answer
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hallucination" id="hallucination" />
                    <Label htmlFor="hallucination" className="text-sm font-normal">
                      Made up information
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="poor_formatting" id="poor_formatting" />
                    <Label htmlFor="poor_formatting" className="text-sm font-normal">
                      Poor formatting
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="missing_data" id="missing_data" />
                    <Label htmlFor="missing_data" className="text-sm font-normal">
                      Missing expected data
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="text-sm font-normal">
                      Other
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="feedback-text" className="text-sm">
                  Additional details (optional)
                </Label>
                <Textarea
                  id="feedback-text"
                  placeholder="Tell us more about the issue..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="mt-1.5 min-h-[80px]"
                />
              </div>

              <Button
                onClick={handleDetailedFeedback}
                disabled={!issueType || isSubmitting}
                className="w-full"
                size="sm"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
