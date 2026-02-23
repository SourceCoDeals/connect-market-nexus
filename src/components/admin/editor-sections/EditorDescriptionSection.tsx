import { lazy, Suspense } from "react";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import { EDITOR_DESIGN } from "@/lib/editor-design-system";

const PremiumRichTextEditor = lazy(() =>
  import("@/components/ui/premium-rich-text-editor").then(m => ({ default: m.PremiumRichTextEditor }))
);
import { cn } from "@/lib/utils";
import { stripHtml } from "@/lib/sanitize";

interface EditorDescriptionSectionProps {
  form: UseFormReturn<any>;
}

export function EditorDescriptionSection({ form }: EditorDescriptionSectionProps) {
  return (
    <div className={cn(EDITOR_DESIGN.cardBg, EDITOR_DESIGN.cardBorder, "rounded-lg", EDITOR_DESIGN.cardPadding)}>
      <div className={cn(EDITOR_DESIGN.microHeader, "mb-4")}>
        Description
      </div>

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Suspense fallback={<div className="h-[300px] animate-pulse bg-muted rounded-lg" />}>
                <PremiumRichTextEditor
                  content={form.getValues('description_html') || field.value || ''}
                  onChange={(html, json) => {
                    form.setValue('description_html', html);
                    form.setValue('description_json', json);
                    // Extract plain text safely using sanitize utility
                    const plainText = stripHtml(html);
                    field.onChange(plainText);
                  }}
                />
              </Suspense>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
