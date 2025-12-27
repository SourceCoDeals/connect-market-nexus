import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  onSourceChange: (source: string) => void;
  onDetailChange: (detail: string) => void;
}

export function ReferralSourceStep({
  referralSource,
  referralSourceDetail,
  onSourceChange,
  onDetailChange,
}: ReferralSourceStepProps) {
  const selectedOption = REFERRAL_SOURCES.find(s => s.id === referralSource);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          How did you hear about us?
        </Label>
        <p className="text-xs text-muted-foreground">
          This helps us understand how you found us. This step is optional.
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
  );
}
