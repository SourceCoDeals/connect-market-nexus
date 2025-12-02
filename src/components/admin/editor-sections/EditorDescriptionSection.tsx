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
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <PremiumRichTextEditor
                content={form.getValues('description_html') || field.value || ''}
                onChange={(html, json) => {
                  form.setValue('description_html', html);
                  form.setValue('description_json', json);
                  // Extract plain text and set the validated 'description' field
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = html;
                  const plainText = tempDiv.textContent || tempDiv.innerText || '';
                  field.onChange(plainText);
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
