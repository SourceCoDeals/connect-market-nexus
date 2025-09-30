import { Control, UseFormSetValue } from "react-hook-form";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { RichTextEditorEnhanced } from "@/components/ui/rich-text-editor-enhanced";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Lightbulb } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DescriptionStepProps {
  control: Control<any>;
  setValue: UseFormSetValue<any>;
}

export function DescriptionStep({ control, setValue }: DescriptionStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Business Description</h2>
        <p className="text-muted-foreground">
          Create a compelling, professional description that attracts qualified buyers
        </p>
      </div>

      <Alert>
        <Lightbulb className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Pro Tip:</strong> Structure your content with clear headings, use bullet points for key features,
          and include specific metrics and achievements. A well-organized description increases buyer engagement by 3x.
        </AlertDescription>
      </Alert>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Content Structure Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div><strong>1. Executive Summary:</strong> Brief overview of the business and opportunity</div>
          <div><strong>2. Business Model:</strong> How the company generates revenue</div>
          <div><strong>3. Operations:</strong> Key processes, technology, and systems</div>
          <div><strong>4. Financial Highlights:</strong> Key metrics and growth trends</div>
          <div><strong>5. Market Position:</strong> Competitive advantages and market opportunity</div>
          <div><strong>6. Growth Potential:</strong> Expansion opportunities and scalability</div>
        </CardContent>
      </Card>

      <FormField
        control={control}
        name="description_html"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <RichTextEditorEnhanced
                content={field.value || ''}
                onChange={(html, json) => {
                  field.onChange(html);
                  setValue('description_json', json);
                  // Keep plain text for backwards compatibility
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = html;
                  const plainText = tempDiv.textContent || tempDiv.innerText || '';
                  setValue('description', plainText);
                }}
                placeholder="Start crafting your professional business description..."
                className="min-h-[600px]"
                characterLimit={20000}
                autoSave={true}
                showWordCount={true}
                showPreview={true}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
