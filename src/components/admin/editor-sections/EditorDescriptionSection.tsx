import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import { PremiumRichTextEditor } from "@/components/ui/premium-rich-text-editor";
import { FileText } from "lucide-react";

interface EditorDescriptionSectionProps {
  form: UseFormReturn<any>;
}

export function EditorDescriptionSection({ form }: EditorDescriptionSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-sourceco-muted">
          <FileText className="h-5 w-5 text-sourceco-accent" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground">Business Description</h3>
          <p className="text-sm text-muted-foreground">Detailed overview and investment highlights</p>
        </div>
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
