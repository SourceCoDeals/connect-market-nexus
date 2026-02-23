import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  Check,
  Sparkles,
  ArrowRight,
  Loader2,
  X,
  Clock,
} from "lucide-react";
import type { ClarificationPanelProps, ClarificationLoadingProps } from "./types";

export function ClarificationPanel({
  questions,
  answers,
  onSelectOption,
  onTextAnswer,
  onCancel,
  onSkip,
  onConfirm,
}: ClarificationPanelProps) {
  return (
    <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <MessageSquare className="h-5 w-5" />
        <h3 className="font-semibold">Let's confirm the details before generating</h3>
      </div>

      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="space-y-2">
            <Label className="text-sm font-medium">{q.question}</Label>

            {q.type === 'text' ? (
              <Textarea
                placeholder={q.placeholder || 'Enter your answer...'}
                value={(answers[q.id] as string) || ''}
                onChange={(e) => onTextAnswer(q.id, e.target.value)}
                className="h-20"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {q.options?.map((option) => {
                  const isSelected = q.type === 'multiSelect'
                    ? ((answers[q.id] as string[]) || []).includes(option)
                    : answers[q.id] === option;

                  return (
                    <Button
                      key={option}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => onSelectOption(q.id, option, q.type === 'multiSelect')}
                      className="transition-all"
                    >
                      {isSelected && <Check className="h-3 w-3 mr-1" />}
                      {option}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Skip & Generate
        </Button>
        <Button onClick={onConfirm}>
          <Sparkles className="h-4 w-4 mr-2" />
          Confirm & Generate
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

export function ClarificationLoading({
  clarifyingStatus,
  onCancel,
}: ClarificationLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>
          {clarifyingStatus.waitingSeconds > 0 ? (
            <>
              <Clock className="h-4 w-4 inline mr-1" />
              Rate limited, retrying in {clarifyingStatus.waitingSeconds}s...
            </>
          ) : clarifyingStatus.retryCount > 0 ? (
            <>Analyzing industry (attempt {clarifyingStatus.retryCount + 1}/3)...</>
          ) : (
            <>Analyzing industry...</>
          )}
        </span>
      </div>
      {clarifyingStatus.waitingSeconds > 0 && (
        <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-full">
          AI service is busy with other requests
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
      >
        <X className="h-4 w-4 mr-1" />
        Cancel
      </Button>
    </div>
  );
}
