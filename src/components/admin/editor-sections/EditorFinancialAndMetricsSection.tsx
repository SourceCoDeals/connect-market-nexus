import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UseFormReturn } from "react-hook-form";
import { EnhancedCurrencyInput } from "@/components/ui/enhanced-currency-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface EditorFinancialAndMetricsSectionProps {
  form: UseFormReturn<any>;
}

export function EditorFinancialAndMetricsSection({ form }: EditorFinancialAndMetricsSectionProps) {
  const metric3Type = form.watch('metric_3_type') || 'employees';
  const metric4Type = form.watch('metric_4_type') || 'ebitda_margin';
  const revenue = form.watch('revenue') || 0;
  const ebitda = form.watch('ebitda') || 0;
  const calculatedMargin = revenue > 0 ? ((ebitda / revenue) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">Financial Overview</h3>
        <p className="text-xs text-muted-foreground">Revenue, EBITDA, metrics display, and investment context</p>
      </div>

      {/* Revenue & EBITDA with Metric Subtitles */}
      <div className="grid grid-cols-2 gap-4">
        {/* Annual Revenue */}
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="revenue"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Annual Revenue</FormLabel>
                <FormControl>
                  <EnhancedCurrencyInput
                    value={field.value?.toString() || ''}
                    onChange={(value) => field.onChange(Number(value))}
                    currencyMode="auto"
                    fieldType="revenue"
                    showSuffix={true}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="space-y-2">
            <Label htmlFor="revenue_metric_subtitle" className="text-xs text-muted-foreground">Display subtitle (optional)</Label>
            <Input
              id="revenue_metric_subtitle"
              placeholder="e.g., Last 12 Months"
              {...form.register('revenue_metric_subtitle')}
              className="h-9 text-sm"
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Shown on detail page below revenue value
            </p>
          </div>
        </div>

        {/* Annual EBITDA */}
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="ebitda"
            render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Annual EBITDA</FormLabel>
            <FormControl>
              <EnhancedCurrencyInput
                value={field.value?.toString() || ''}
                onChange={(value) => field.onChange(Number(value))}
                currencyMode="auto"
                fieldType="revenue"
                showSuffix={true}
              />
            </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="space-y-2">
            <Label htmlFor="ebitda_metric_subtitle" className="text-xs text-muted-foreground">Display subtitle (optional)</Label>
            <Input
              id="ebitda_metric_subtitle"
              placeholder="e.g., Adjusted EBITDA"
              {...form.register('ebitda_metric_subtitle')}
              className="h-9 text-sm"
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Shown on detail page below EBITDA value
            </p>
          </div>
        </div>
      </div>

      {/* Employee Counts */}
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="full_time_employees"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Full-Time Employees</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="0"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                  value={field.value ?? ''}
                  className="h-10"
                />
              </FormControl>
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
                  placeholder="0"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                  value={field.value ?? ''}
                  className="h-10"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Metric 3 & 4 Configuration */}
      <div className="grid grid-cols-2 gap-4">
        {/* Metric 3: Team Size or Custom */}
        <div className="space-y-3 p-4 bg-slate-50/30 border rounded-lg">
          <h4 className="text-sm font-medium">Metric 3: Team Size</h4>
          
          <RadioGroup
            value={metric3Type}
            onValueChange={(value) => form.setValue('metric_3_type', value)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="employees" id="metric3-employees" className="h-4 w-4" />
              <Label htmlFor="metric3-employees" className="text-sm font-normal cursor-pointer">
                Show team size
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="metric3-custom" className="h-4 w-4" />
              <Label htmlFor="metric3-custom" className="text-sm font-normal cursor-pointer">
                Custom metric
              </Label>
            </div>
          </RadioGroup>

          {metric3Type === 'custom' && (
            <div className="space-y-2 mt-3 pt-3 border-t">
              <Input
                id="metric_3_custom_label"
                placeholder="Label"
                {...form.register('metric_3_custom_label')}
                className="h-9 text-sm"
              />
              <Input
                id="metric_3_custom_value"
                placeholder="Value"
                {...form.register('metric_3_custom_value')}
                className="h-9 text-sm"
              />
              <Input
                id="metric_3_custom_subtitle"
                placeholder="Subtitle (optional)"
                {...form.register('metric_3_custom_subtitle')}
                className="h-9 text-sm"
              />
            </div>
          )}
        </div>

        {/* Metric 4: EBITDA Margin or Custom */}
        <div className="space-y-3 p-4 bg-slate-50/30 border rounded-lg">
          <h4 className="text-sm font-medium">Metric 4: EBITDA Margin</h4>
          
          <RadioGroup
            value={metric4Type}
            onValueChange={(value) => form.setValue('metric_4_type', value)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ebitda_margin" id="metric4-ebitda" className="h-4 w-4" />
              <Label htmlFor="metric4-ebitda" className="text-sm font-normal cursor-pointer">
                Show EBITDA margin
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="metric4-custom" className="h-4 w-4" />
              <Label htmlFor="metric4-custom" className="text-sm font-normal cursor-pointer">
                Custom metric
              </Label>
            </div>
          </RadioGroup>

          {metric4Type === 'ebitda_margin' ? (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">Calculated: {calculatedMargin}%</p>
              <Input
                id="metric_4_custom_subtitle"
                placeholder="Subtitle (optional)"
                {...form.register('metric_4_custom_subtitle')}
                className="h-9 text-sm"
              />
            </div>
          ) : (
            <div className="space-y-2 mt-3 pt-3 border-t">
              <Input
                id="metric_4_custom_label"
                placeholder="Label"
                {...form.register('metric_4_custom_label')}
                className="h-9 text-sm"
              />
              <Input
                id="metric_4_custom_value"
                placeholder="Value"
                {...form.register('metric_4_custom_value')}
                className="h-9 text-sm"
              />
              <Input
                id="metric_4_custom_subtitle"
                placeholder="Subtitle (optional)"
                {...form.register('metric_4_custom_subtitle')}
                className="h-9 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Owner Notes */}
      <FormField
        control={form.control}
        name="owner_notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium">Owner Investment Thesis (Internal)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Internal context and investment rationale..."
                className="min-h-[60px] text-sm"
                {...field}
                value={field.value || ''}
              />
            </FormControl>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Internal notes about why this deal is compelling
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
