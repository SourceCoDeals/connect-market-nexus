import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

interface InvestmentSectionProps {
  form: UseFormReturn<any>;
}

export function InvestmentSection({ form }: InvestmentSectionProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2">Investment Context</h2>
        <p className="text-sm text-muted-foreground">
          Additional insights and context for potential buyers
        </p>
      </div>

      <Card className="p-6 space-y-6 border-muted/50">
        <FormField
          control={form.control}
          name="owner_notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Owner Notes & Context</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Additional context about the business, owner intentions, timeline, or special considerations..."
                  className="min-h-[200px] resize-none text-base"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-xs">
                Provide any additional context that would help buyers understand the opportunity
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </Card>
    </div>
  );
}
