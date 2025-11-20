import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import { PremiumRichTextEditor } from "@/components/ui/premium-rich-text-editor";
import { EDITOR_DESIGN } from "@/lib/editor-design-system";
import { cn } from "@/lib/utils";

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
        name="description_html"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <PremiumRichTextEditor
                content={field.value || form.getValues('description') || ''}
                onChange={(html, json) => {
                  field.onChange(html);
                  form.setValue('description_json', json);
                  // Keep plain text for backwards compatibility
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = html;
                  const plainText = tempDiv.textContent || tempDiv.innerText || '';
                  form.setValue('description', plainText);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
