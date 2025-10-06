import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import { EnhancedCurrencyInput } from "@/components/ui/enhanced-currency-input";
import { DollarSign } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface EditorFinancialSectionProps {
  form: UseFormReturn<any>;
}

export function EditorFinancialSection({ form }: EditorFinancialSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-sourceco-muted">
          <DollarSign className="h-5 w-5 text-sourceco-accent" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground">Financial Overview</h3>
          <p className="text-sm text-muted-foreground">Key financial metrics and performance indicators</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FormField
          control={form.control}
          name="revenue"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Annual Revenue</FormLabel>
              <FormControl>
                <EnhancedCurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  currencyMode="millions"
                  fieldType="revenue"
                  showSuffix={true}
                  className="h-11 bg-background border-border focus:border-sourceco-accent transition-colors"
                />
              </FormControl>
              <FormDescription>
                Enter the trailing twelve months (TTM) revenue
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ebitda"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Annual EBITDA</FormLabel>
              <FormControl>
                <EnhancedCurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  currencyMode="millions"
                  fieldType="revenue"
                  showSuffix={true}
                  className="h-11 bg-background border-border focus:border-sourceco-accent transition-colors"
                />
              </FormControl>
              <FormDescription>
                Enter the trailing twelve months (TTM) EBITDA
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="full_time_employees"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Full-Time Employees</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g., 45"
                  className="h-11 bg-background border-border focus:border-sourceco-accent transition-colors"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </FormControl>
              <FormDescription>
                Number of full-time employees (optional)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="part_time_employees"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Part-Time Employees</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g., 5"
                  className="h-11 bg-background border-border focus:border-sourceco-accent transition-colors"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </FormControl>
              <FormDescription>
                Number of part-time employees (optional)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="owner_notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Investment Context (Internal)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Key investment highlights, deal rationale, exit considerations..."
                className="min-h-[100px] bg-background border-border focus:border-sourceco-accent transition-colors resize-none"
                {...field}
              />
            </FormControl>
            <FormDescription>
              Internal notes visible only to admins
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
