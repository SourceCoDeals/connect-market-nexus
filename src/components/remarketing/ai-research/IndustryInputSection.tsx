import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, RefreshCw, Upload } from "lucide-react";
import type { IndustryInputSectionProps, ResumeBannerProps, DuplicateWarningProps } from "./types";

export function IndustryInputSection({
  industryName,
  industryDescription,
  state,
  isUploadingGuide,
  onIndustryNameChange,
  onIndustryDescriptionChange,
  onStartClarification,
  onUploadClick,
  guideFileInputRef,
  onUploadGuide,
}: IndustryInputSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="industry-name">Industry Name</Label>
          <Input
            id="industry-name"
            placeholder="e.g., Collision Repair, HVAC, Pest Control, Restoration"
            value={industryName}
            onChange={(e) => onIndustryNameChange(e.target.value)}
          />
        </div>

        <Button onClick={onStartClarification} disabled={!industryName.trim()}>
          <Sparkles className="h-4 w-4 mr-2" />
          {state === 'complete' ? 'Regenerate' : 'Generate Guide'}
        </Button>

        <span className="text-xs text-muted-foreground self-center">or</span>

        <Button
          variant="outline"
          onClick={onUploadClick}
          disabled={isUploadingGuide}
        >
          {isUploadingGuide ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Upload Guide
        </Button>
        <input
          ref={guideFileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.html,.htm"
          className="hidden"
          onChange={onUploadGuide}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="industry-description">Industry Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Textarea
          id="industry-description"
          placeholder="Provide a 2-3 sentence description of this industry to help guide the AI research. For example: 'Water damage restoration and mold remediation services for residential and commercial properties. Companies typically respond to insurance claims and emergency situations.'"
          value={industryDescription}
          onChange={(e) => onIndustryDescriptionChange(e.target.value)}
          className="min-h-[80px] resize-none"
        />
      </div>
    </div>
  );
}

export function ResumeBanner({ savedProgress, onResume, onClear }: ResumeBannerProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
      <div>
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Previous generation was interrupted at phase {savedProgress.batchIndex + 1} of 13
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {savedProgress.content.split(/\s+/).length.toLocaleString()} words generated
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onResume}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Resume
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Start Over
        </Button>
      </div>
    </div>
  );
}

export function DuplicateWarning({ existingContent, onProceed, onCancel }: DuplicateWarningProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
      <div>
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          A guide already exists ({(existingContent?.split(/\s+/).length || 0).toLocaleString()} words)
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Regenerating will replace the existing content.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={onProceed}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Regenerate Anyway
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
