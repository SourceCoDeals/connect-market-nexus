import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BookOpen,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { GuideGenerationErrorPanel } from "../GuideGenerationErrorPanel";
import { GenerationSummaryPanel } from "../GenerationSummaryPanel";
import { GuideCompletionDialog } from "../GuideCompletionDialog";
import { useAIResearchGeneration } from "./useAIResearchGeneration";
import { ClarificationPanel, ClarificationLoading } from "./ClarificationPanel";
import { GenerationProgress, QualityResultPanel, GapFillProgress } from "./GenerationProgress";
import { IndustryInputSection, ResumeBanner, DuplicateWarning } from "./IndustryInputSection";
import type { AIResearchSectionProps } from "./types";

export const AIResearchSection = (props: AIResearchSectionProps) => {
  const { existingContent } = props;

  const {
    isOpen,
    setIsOpen,
    industryName,
    setIndustryName,
    industryDescription,
    setIndustryDescription,
    state,
    currentPhase,
    totalPhases,
    phaseName,
    wordCount,
    qualityResult,
    missingElements,
    errorDetails,
    generationSummary,
    setGenerationSummary,
    showCompletionDialog,
    setShowCompletionDialog,
    completedDocumentUrl,
    clarifyingQuestions,
    clarifyAnswers,
    clarifyingStatus,
    setClarifyingStatus,
    showDuplicateWarning,
    setShowDuplicateWarning,
    currentBatch,
    totalBatches,
    savedProgress,
    isUploadingGuide,
    guideFileInputRef,
    progressPercent,
    handleUploadGuide,
    handleStartClarification,
    proceedWithClarification,
    handleSelectOption,
    handleTextAnswer,
    handleConfirmAndGenerate,
    handleSkipClarification,
    handleCancel,
    handleErrorRetry,
    handleErrorResume,
    handleErrorCancel,
    resumeGeneration,
    clearProgress,
  } = useAIResearchGeneration(props);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">M&A Research Guide</CardTitle>
              <CardDescription>
                {existingContent && existingContent.length > 100
                  ? `${wordCount.toLocaleString()} word industry research guide`
                  : 'Generate comprehensive 30,000+ word industry research guide'
                }
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {state === 'complete' && (
              <Badge variant="default" className="bg-green-600">
                <Check className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            )}
            {wordCount > 0 && state !== 'complete' && (
              <Badge variant="secondary">{wordCount.toLocaleString()} words</Badge>
            )}
            {/* Generate/Regenerate button always visible in header */}
            {(state === 'idle' || state === 'complete' || state === 'error') && !isOpen && (
              <Button
                size="sm"
                variant={existingContent && existingContent.length > 100 ? "outline" : "default"}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(true);
                  if (!existingContent || existingContent.length < 100) {
                    // Auto-trigger for new guides
                  }
                }}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                {existingContent && existingContent.length > 100 ? 'View Guide' : 'Run AI Research'}
              </Button>
            )}
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>

        {/* Preview when collapsed and has content */}
        {!isOpen && existingContent && existingContent.length > 100 && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {existingContent.replace(/[#*`]/g, '').substring(0, 200)}...
            </p>
          </div>
        )}
      </CardHeader>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Duplicate guide warning */}
            {showDuplicateWarning && existingContent && (
              <DuplicateWarning
                existingContent={existingContent}
                onProceed={proceedWithClarification}
                onCancel={() => setShowDuplicateWarning(false)}
              />
            )}

            {/* Resume interrupted generation */}
            {savedProgress && state === 'idle' && !showDuplicateWarning && (
              <ResumeBanner
                savedProgress={savedProgress}
                onResume={() => resumeGeneration(savedProgress)}
                onClear={clearProgress}
              />
            )}

            {/* Generation Summary Panel */}
            {generationSummary && state !== 'generating' && (
              <GenerationSummaryPanel
                summary={generationSummary}
                onResume={generationSummary.isRecoverable ? handleErrorResume : undefined}
                onDismiss={() => setGenerationSummary(null)}
                hasCheckpoint={!!savedProgress || (wordCount > 0 && generationSummary.wordCount > 0)}
              />
            )}

            {/* Error Panel */}
            {state === 'error' && errorDetails && !generationSummary && (
              <GuideGenerationErrorPanel
                errorDetails={errorDetails}
                onRetry={handleErrorRetry}
                onResume={handleErrorResume}
                onCancel={handleErrorCancel}
                hasCheckpoint={!!savedProgress || (wordCount > 0 && errorDetails.savedWordCount !== undefined && errorDetails.savedWordCount > 0)}
                totalBatches={totalBatches}
              />
            )}

            {/* Industry Input */}
            {(state === 'idle' || state === 'complete' || (state === 'error' && !errorDetails)) && (
              <IndustryInputSection
                industryName={industryName}
                industryDescription={industryDescription}
                state={state}
                isUploadingGuide={isUploadingGuide}
                onIndustryNameChange={setIndustryName}
                onIndustryDescriptionChange={setIndustryDescription}
                onStartClarification={handleStartClarification}
                onUploadClick={() => guideFileInputRef.current?.click()}
                guideFileInputRef={guideFileInputRef}
                onUploadGuide={handleUploadGuide}
              />
            )}

            {/* Clarification Questions UI */}
            {state === 'clarifying' && clarifyingQuestions.length > 0 && (
              <ClarificationPanel
                questions={clarifyingQuestions}
                answers={clarifyAnswers}
                onSelectOption={handleSelectOption}
                onTextAnswer={handleTextAnswer}
                onCancel={handleCancel}
                onSkip={handleSkipClarification}
                onConfirm={handleConfirmAndGenerate}
              />
            )}

            {/* Loading state for clarification */}
            {state === 'clarifying' && clarifyingQuestions.length === 0 && (
              <ClarificationLoading
                clarifyingStatus={clarifyingStatus}
                onCancel={() => {
                  setClarifyingStatus({ isLoading: false, retryCount: 0, waitingSeconds: 0, error: null });
                  handleCancel();
                }}
              />
            )}

            {/* Progress */}
            {(state === 'generating' || state === 'quality_check' || state === 'gap_filling') && (
              <GenerationProgress
                state={state}
                currentBatch={currentBatch}
                totalBatches={totalBatches}
                currentPhase={currentPhase}
                totalPhases={totalPhases}
                phaseName={phaseName}
                wordCount={wordCount}
                progressPercent={progressPercent}
                onCancel={handleCancel}
              />
            )}

            {/* Quality Result */}
            {qualityResult && (
              <QualityResultPanel qualityResult={qualityResult} />
            )}

            {/* Gap Fill Progress */}
            <GapFillProgress state={state} missingElements={missingElements} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Completion Dialog */}
      <GuideCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        industryName={industryName}
        wordCount={wordCount}
        documentUrl={completedDocumentUrl || undefined}
      />
    </Card>
  );
};
