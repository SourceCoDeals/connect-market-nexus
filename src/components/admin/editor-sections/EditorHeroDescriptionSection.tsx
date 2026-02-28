import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { UseFormReturn } from "react-hook-form";
import { EDITOR_DESIGN } from "@/lib/editor-design-system";
import { cn } from "@/lib/utils";
import { Sparkles, Loader2 } from "lucide-react";

interface EditorHeroDescriptionSectionProps {
  form: UseFormReturn<any>;
  onAiGenerate?: (field: string) => void;
  isGenerating?: boolean;
  generatingField?: string | null;
}

export function EditorHeroDescriptionSection({ form, onAiGenerate, isGenerating, generatingField }: EditorHeroDescriptionSectionProps) {
  const heroDescriptionValue = form.watch('hero_description') || '';
  const charCount = heroDescriptionValue.length;
  const maxChars = 500;
  const isFieldGenerating = isGenerating && generatingField === 'hero_description';

  return (
    <div className={cn(EDITOR_DESIGN.cardBg, EDITOR_DESIGN.cardBorder, "rounded-lg", EDITOR_DESIGN.cardPadding)}>
      <div className={cn(EDITOR_DESIGN.microHeader, "mb-4 flex items-center justify-between")}>
        <span>Hero Description</span>
        {/* GAP 5: AI generate button */}
        {onAiGenerate && (
          <button
            type="button"
            onClick={() => onAiGenerate('hero_description')}
            disabled={isGenerating}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
          >
            {isFieldGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {isFieldGenerating ? 'Generating...' : 'Generate with AI'}
          </button>
        )}
      </div>

      <FormField
        control={form.control}
        name="hero_description"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">
              Custom Preview Text
              <span className="text-xs text-muted-foreground ml-2">
                ({charCount}/{maxChars} characters)
              </span>
            </FormLabel>
            <FormDescription className="text-xs">
              This text appears in the listing header preview. If left empty, the first few lines of the main description will be shown instead.
            </FormDescription>
            <FormControl>
              <Textarea
                {...field}
                value={field.value || ''}
                placeholder="Enter a custom preview description for this listing (optional)"
                className="min-h-[120px] resize-y"
                maxLength={maxChars}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
