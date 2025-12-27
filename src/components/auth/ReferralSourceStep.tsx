import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { 
  DEAL_SOURCING_METHOD_OPTIONS, 
  TARGET_ACQUISITION_VOLUME_OPTIONS 
} from "@/lib/signup-field-options";

// Referral source options matching the Attio screenshot
const REFERRAL_SOURCES = [
  { id: 'billboard', label: 'Billboard / Outside', followUpQuestion: 'Where did you see it?', placeholder: 'e.g., NYC Times Square, Highway 101' },
  { id: 'friend', label: 'Friends / Coworker', followUpQuestion: 'Who referred you? (optional)', placeholder: 'e.g., John from Acme Corp' },
  { id: 'google', label: 'Google', followUpQuestion: 'What were you searching for?', placeholder: 'e.g., M&A deal sourcing, business acquisition' },
  { id: 'twitter', label: 'X.com', followUpQuestion: 'Was it a post, ad, or thread?', placeholder: 'e.g., Post from @sourceco' },
  { id: 'instagram', label: 'Instagram', followUpQuestion: 'Was it a post, ad, or story?', placeholder: 'e.g., Sponsored ad' },
  { id: 'ai', label: 'AI', followUpQuestion: 'Which AI assistant?', placeholder: 'e.g., ChatGPT, Claude, Perplexity' },
  { id: 'newsletter', label: 'Newsletter', followUpQuestion: 'Which newsletter?', placeholder: 'e.g., Morning Brew, The Hustle' },
  { id: 'reddit', label: 'Reddit', followUpQuestion: 'Which subreddit?', placeholder: 'e.g., r/entrepreneur, r/smallbusiness' },
  { id: 'facebook', label: 'Facebook', followUpQuestion: 'Was it a post, group, or ad?', placeholder: 'e.g., M&A Professionals group' },
  { id: 'linkedin', label: 'LinkedIn', followUpQuestion: 'Was it a post, ad, or someone\'s profile?', placeholder: 'e.g., Post from industry expert' },
  { id: 'youtube', label: 'YouTube', followUpQuestion: 'Which channel or video?', placeholder: 'e.g., Acquisition Lab channel' },
  { id: 'podcast', label: 'Podcast', followUpQuestion: 'Which podcast?', placeholder: 'e.g., Acquire.com podcast' },
  { id: 'other', label: 'Other', followUpQuestion: 'Please specify', placeholder: 'e.g., Industry conference, webinar' },
] as const;

interface ReferralSourceStepProps {
  referralSource: string;
  referralSourceDetail: string;
  dealSourcingMethods: string[];
  targetAcquisitionVolume: string;
  onSourceChange: (source: string) => void;
  onDetailChange: (detail: string) => void;
  onDealSourcingMethodsChange: (methods: string[]) => void;
  onTargetAcquisitionVolumeChange: (volume: string) => void;
}

export function ReferralSourceStep({
  referralSource,
  referralSourceDetail,
  dealSourcingMethods,
  targetAcquisitionVolume,
  onSourceChange,
  onDetailChange,
  onDealSourcingMethodsChange,
  onTargetAcquisitionVolumeChange,
}: ReferralSourceStepProps) {
  const selectedOption = REFERRAL_SOURCES.find(s => s.id === referralSource);

  const handleMethodToggle = (methodValue: string) => {
    const isSelected = dealSourcingMethods.includes(methodValue);
    if (isSelected) {
      onDealSourcingMethodsChange(dealSourcingMethods.filter(m => m !== methodValue));
    } else {
      onDealSourcingMethodsChange([...dealSourcingMethods, methodValue]);
    }
  };

  return (
    <div className="space-y-8">
      {/* How did you hear about us? */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            How did you hear about us?
          </Label>
          <p className="text-xs text-muted-foreground">
            This helps us understand how you found us. All questions on this page are optional.
          </p>
        </div>

        {/* Source Selection Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {REFERRAL_SOURCES.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => {
                onSourceChange(source.id);
                onDetailChange(''); // Reset detail when source changes
              }}
              className={cn(
                "px-3 py-2.5 text-xs font-medium rounded-lg border transition-all duration-150",
                "hover:border-primary/50 hover:bg-accent/50",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                referralSource === source.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground"
              )}
            >
              {source.label}
            </button>
          ))}
        </div>

        {/* Conditional Follow-up Question */}
        {selectedOption && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <Label htmlFor="referralDetail" className="text-xs text-muted-foreground">
              {selectedOption.followUpQuestion}
            </Label>
            <Input
              id="referralDetail"
              value={referralSourceDetail}
              onChange={(e) => onDetailChange(e.target.value)}
              placeholder={selectedOption.placeholder}
              className="text-sm"
            />
          </div>
        )}
      </div>

      {/* Deal Sourcing Methods */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            How do you typically source acquisition targets today?
          </Label>
          <p className="text-xs text-muted-foreground">
            Select all that apply.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DEAL_SOURCING_METHOD_OPTIONS.map((option) => {
            const isSelected = dealSourcingMethods.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleMethodToggle(option.value)}
                className={cn(
                  "flex items-center space-x-3 p-3 rounded-lg border transition-all duration-150 text-left",
                  "hover:border-primary/50 hover:bg-accent/30",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background"
                )}
                aria-pressed={isSelected}
              >
                <div 
                  className={cn(
                    "flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors",
                    isSelected 
                      ? "bg-primary border-primary" 
                      : "bg-background border-border"
                  )}
                >
                  {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className="text-xs font-normal flex-1">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Acquisition Volume */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            How many acquisitions are you targeting in the next 12 months?
          </Label>
        </div>

        <Select
          value={targetAcquisitionVolume}
          onValueChange={onTargetAcquisitionVolumeChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {TARGET_ACQUISITION_VOLUME_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
