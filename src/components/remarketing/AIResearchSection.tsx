import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  BookOpen, 
  Sparkles, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  Check,
  X,
  AlertCircle,
  Download,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { SizeCriteria, GeographyCriteria, ServiceCriteria, BuyerTypesCriteria } from "@/types/remarketing";

type GenerationState = 'idle' | 'generating' | 'quality_check' | 'gap_filling' | 'complete' | 'error';

interface QualityResult {
  passed: boolean;
  score: number;
  wordCount: number;
  tableCount: number;
  placeholderCount: number;
  hasCriteria: boolean;
  hasBuyerTypes: boolean;
  hasPrimaryFocus: boolean;
  missingElements: string[];
}

interface ExtractedCriteria {
  size_criteria?: SizeCriteria;
  geography_criteria?: GeographyCriteria;
  service_criteria?: ServiceCriteria;
  buyer_types_criteria?: BuyerTypesCriteria;
}

interface AIResearchSectionProps {
  onGuideGenerated: (content: string, criteria: ExtractedCriteria) => void;
  universeName?: string;
  existingContent?: string;
}

export const AIResearchSection = ({ 
  onGuideGenerated,
  universeName,
  existingContent
}: AIResearchSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [industryName, setIndustryName] = useState(universeName || "");
  const [state, setState] = useState<GenerationState>('idle');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [totalPhases, setTotalPhases] = useState(12);
  const [phaseName, setPhaseName] = useState("");
  const [content, setContent] = useState(existingContent || "");
  const [wordCount, setWordCount] = useState(0);
  const [qualityResult, setQualityResult] = useState<QualityResult | null>(null);
  const [extractedCriteria, setExtractedCriteria] = useState<ExtractedCriteria | null>(null);
  const [missingElements, setMissingElements] = useState<string[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (universeName && !industryName) {
      setIndustryName(universeName);
    }
  }, [universeName]);

  useEffect(() => {
    if (existingContent) {
      setContent(existingContent);
      setWordCount(existingContent.split(/\s+/).length);
    }
  }, [existingContent]);

  const handleGenerate = async () => {
    if (!industryName.trim()) {
      toast.error("Please enter an industry name");
      return;
    }

    setState('generating');
    setCurrentPhase(0);
    setContent("");
    setWordCount(0);
    setQualityResult(null);
    setExtractedCriteria(null);
    setMissingElements([]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ma-guide`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            industry_name: industryName,
            existing_content: existingContent,
            stream: true
          }),
          signal: abortControllerRef.current.signal
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const event = JSON.parse(jsonStr);

            switch (event.type) {
              case 'phase_start':
                setCurrentPhase(event.phase);
                setTotalPhases(event.total);
                setPhaseName(event.name);
                break;

              case 'content':
                fullContent += event.content;
                setContent(fullContent);
                setWordCount(fullContent.split(/\s+/).length);
                // Auto-scroll
                if (contentRef.current) {
                  contentRef.current.scrollTop = contentRef.current.scrollHeight;
                }
                break;

              case 'phase_complete':
                setWordCount(event.wordCount || fullContent.split(/\s+/).length);
                break;

              case 'quality_check_start':
                setState('quality_check');
                break;

              case 'quality_check_result':
                setQualityResult(event.result);
                break;

              case 'gap_fill_start':
                setState('gap_filling');
                setMissingElements(event.missingElements || []);
                break;

              case 'gap_fill_complete':
              case 'final_quality':
                if (event.result) {
                  setQualityResult(event.result);
                }
                break;

              case 'criteria_extraction_start':
                // Extracting criteria
                break;

              case 'criteria':
                setExtractedCriteria(event.criteria);
                break;

              case 'complete':
                setState('complete');
                setContent(event.content || fullContent);
                setWordCount(event.totalWords || fullContent.split(/\s+/).length);
                toast.success("M&A Guide generated successfully!");
                break;

              case 'error':
                throw new Error(event.message);
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        toast.info("Generation cancelled");
        setState('idle');
      } else {
        console.error('Generation error:', error);
        toast.error(`Generation failed: ${(error as Error).message}`);
        setState('error');
      }
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState('idle');
  };

  const handleApply = () => {
    if (content && extractedCriteria) {
      onGuideGenerated(content, extractedCriteria);
      toast.success("Guide and criteria applied");
    }
  };

  const handleExport = () => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${industryName.replace(/\s+/g, '-')}-ma-guide.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const progressPercent = totalPhases > 0 ? (currentPhase / totalPhases) * 100 : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">AI Research (M&A Guide)</CardTitle>
                  <CardDescription>
                    Generate comprehensive 30,000+ word industry research guide
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
                {wordCount > 0 && (
                  <Badge variant="secondary">{wordCount.toLocaleString()} words</Badge>
                )}
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Industry Input */}
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="industry-name">Industry Name</Label>
                <Input
                  id="industry-name"
                  placeholder="e.g., Collision Repair, HVAC, Pest Control"
                  value={industryName}
                  onChange={(e) => setIndustryName(e.target.value)}
                  disabled={state === 'generating' || state === 'gap_filling'}
                />
              </div>
              
              {state === 'idle' || state === 'complete' || state === 'error' ? (
                <Button onClick={handleGenerate} disabled={!industryName.trim()}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {state === 'complete' ? 'Regenerate' : 'Generate Guide'}
                </Button>
              ) : (
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>

            {/* Progress */}
            {(state === 'generating' || state === 'quality_check' || state === 'gap_filling') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {state === 'generating' && `Phase ${currentPhase}/${totalPhases}: ${phaseName}`}
                    {state === 'quality_check' && 'Running quality check...'}
                    {state === 'gap_filling' && 'Filling content gaps...'}
                  </span>
                  <span className="text-muted-foreground">{wordCount.toLocaleString()} words</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            )}

            {/* Quality Result */}
            {qualityResult && (
              <div className={`p-3 rounded-lg border ${qualityResult.passed ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {qualityResult.passed ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    )}
                    <span className="font-medium">
                      Quality Score: {qualityResult.score}/100
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline">{qualityResult.wordCount.toLocaleString()} words</Badge>
                    <Badge variant="outline">{qualityResult.tableCount} tables</Badge>
                    {qualityResult.hasPrimaryFocus ? (
                      <Badge variant="default" className="bg-green-600">Primary Focus ✓</Badge>
                    ) : (
                      <Badge variant="destructive">Missing Primary Focus</Badge>
                    )}
                  </div>
                </div>
                {qualityResult.missingElements.length > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium">Needs improvement:</span> {qualityResult.missingElements.join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Content Preview */}
            {content && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Generated Content</Label>
                  <div className="flex gap-2">
                    {state === 'complete' && extractedCriteria && (
                      <Button size="sm" onClick={handleApply}>
                        <Check className="h-4 w-4 mr-1" />
                        Apply Criteria
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handleExport}>
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[400px] border rounded-lg p-4" ref={contentRef}>
                  <div 
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
                </ScrollArea>
              </div>
            )}

            {/* Extracted Criteria Preview */}
            {extractedCriteria && state === 'complete' && (
              <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Extracted Criteria
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {extractedCriteria.size_criteria && (
                    <div>
                      <span className="text-muted-foreground">Size:</span>
                      <div className="font-medium">
                        {extractedCriteria.size_criteria.revenue_min && 
                          `$${(extractedCriteria.size_criteria.revenue_min / 1000000).toFixed(1)}M - $${((extractedCriteria.size_criteria.revenue_max || 0) / 1000000).toFixed(1)}M`}
                      </div>
                    </div>
                  )}
                  {extractedCriteria.geography_criteria?.target_states && (
                    <div>
                      <span className="text-muted-foreground">Geography:</span>
                      <div className="font-medium">
                        {extractedCriteria.geography_criteria.target_states.slice(0, 3).join(', ')}
                        {extractedCriteria.geography_criteria.target_states.length > 3 && 
                          ` +${extractedCriteria.geography_criteria.target_states.length - 3}`}
                      </div>
                    </div>
                  )}
                  {extractedCriteria.service_criteria?.primary_focus && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Primary Focus:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {extractedCriteria.service_criteria.primary_focus.map((s, i) => (
                          <Badge key={i} variant="default" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Gap Fill Progress */}
            {state === 'gap_filling' && missingElements.length > 0 && (
              <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                  <span className="font-medium">Generating additional content for:</span>
                </div>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {missingElements.map((elem, i) => (
                    <li key={i}>{elem}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
