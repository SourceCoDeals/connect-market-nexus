import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { PremiumRichTextEditor } from "../PremiumRichTextEditor";
import { Lightbulb } from "lucide-react";

interface DescriptionSectionProps {
  form: UseFormReturn<any>;
}

export function DescriptionSection({ form }: DescriptionSectionProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2">Professional Description</h2>
        <p className="text-sm text-muted-foreground">
          Investment-grade narrative that tells the business story compellingly
        </p>
      </div>

      <Card className="p-6 border-primary/10 bg-primary/5">
        <div className="flex gap-3">
          <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">Professional Writing Guidelines</p>
            <ul className="space-y-1 text-muted-foreground text-xs">
              <li>• Start with a compelling executive summary (2-3 sentences)</li>
              <li>• Describe the business model and core operations clearly</li>
              <li>• Highlight competitive advantages and market position</li>
              <li>• Include growth opportunities and future potential</li>
              <li>• Use specific metrics and achievements where possible</li>
            </ul>
          </div>
        </div>
      </Card>

      <FormField
        control={form.control}
        name="business_description"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Business Description *</FormLabel>
            <FormControl>
              <PremiumRichTextEditor
                content={field.value || ""}
                onChange={field.onChange}
                placeholder="Describe the business opportunity..."
              />
            </FormControl>
            <FormDescription className="text-xs">
              Minimum 100 characters. Use the formatting tools to create a professional, structured description.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
