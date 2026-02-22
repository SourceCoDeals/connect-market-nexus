import { UseFormReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface EditorMetricsSectionProps {
  form: UseFormReturn<any>;
}

export function EditorMetricsSection({ form }: EditorMetricsSectionProps) {
  const metric3Type = form.watch('metric_3_type') || 'employees';
  const metric4Type = form.watch('metric_4_type') || 'ebitda_margin';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold mb-4">Metrics Display Configuration</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Customize how the 4 key metrics appear on the listing detail page.
        </p>
      </div>

      {/* Metric 1: Revenue */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
        <h4 className="text-sm font-medium">Metric 1: Annual Revenue</h4>
        <div className="space-y-2">
          <Label htmlFor="revenue_metric_subtitle" className="text-xs">Subtitle (optional)</Label>
          <Input
            id="revenue_metric_subtitle"
            placeholder="e.g., Last 12 Months, Trailing Twelve Months"
            {...form.register('revenue_metric_subtitle')}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Appears below the revenue value. Defaults to category if empty.
          </p>
        </div>
      </div>

      {/* Metric 2: EBITDA */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
        <h4 className="text-sm font-medium">Metric 2: Annual EBITDA</h4>
        <div className="space-y-2">
          <Label htmlFor="ebitda_metric_subtitle" className="text-xs">Subtitle (optional)</Label>
          <Input
            id="ebitda_metric_subtitle"
            placeholder="e.g., Adjusted EBITDA, Normalized Earnings"
            {...form.register('ebitda_metric_subtitle')}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Appears below the EBITDA value. Defaults to margin percentage if empty.
          </p>
        </div>
      </div>

      {/* Metric 3: Team Size or Custom */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
        <h4 className="text-sm font-medium">Metric 3</h4>
        
        <RadioGroup
          value={metric3Type}
          onValueChange={(value) => form.setValue('metric_3_type', value)}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="employees" id="metric3-employees" />
            <Label htmlFor="metric3-employees" className="text-sm font-normal cursor-pointer">
              Team Size (Full-time & Part-time employees)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="custom" id="metric3-custom" />
            <Label htmlFor="metric3-custom" className="text-sm font-normal cursor-pointer">
              Custom Metric
            </Label>
          </div>
        </RadioGroup>

        {metric3Type === 'custom' && (
          <div className="space-y-3 mt-3 pl-6 border-l-2">
            <div className="space-y-2">
              <Label htmlFor="metric_3_custom_label" className="text-xs">Label</Label>
              <Input
                id="metric_3_custom_label"
                placeholder="e.g., Active Customers"
                {...form.register('metric_3_custom_label')}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metric_3_custom_value" className="text-xs">Value</Label>
              <Input
                id="metric_3_custom_value"
                placeholder="e.g., 5,000+"
                {...form.register('metric_3_custom_value')}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metric_3_custom_subtitle" className="text-xs">Subtitle (optional)</Label>
              <Input
                id="metric_3_custom_subtitle"
                placeholder="e.g., Growing 20% YoY"
                {...form.register('metric_3_custom_subtitle')}
                className="text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Metric 4: EBITDA Margin or Custom */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
        <h4 className="text-sm font-medium">Metric 4</h4>
        
        <RadioGroup
          value={metric4Type}
          onValueChange={(value) => form.setValue('metric_4_type', value)}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="ebitda_margin" id="metric4-ebitda" />
            <Label htmlFor="metric4-ebitda" className="text-sm font-normal cursor-pointer">
              EBITDA Margin (Calculated automatically)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="custom" id="metric4-custom" />
            <Label htmlFor="metric4-custom" className="text-sm font-normal cursor-pointer">
              Custom Metric
            </Label>
          </div>
        </RadioGroup>

        {metric4Type === 'ebitda_margin' && (
          <div className="space-y-2 mt-3 pl-6 border-l-2">
            <div className="space-y-2">
              <Label htmlFor="metric_4_custom_subtitle" className="text-xs">Subtitle (optional)</Label>
              <Input
                id="metric_4_custom_subtitle"
                placeholder="e.g., Profitability metric, Margin profile"
                {...form.register('metric_4_custom_subtitle')}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Margin is calculated automatically from EBITDA ÷ Revenue
              </p>
            </div>
          </div>
        )}

        {metric4Type === 'custom' && (
          <div className="space-y-3 mt-3 pl-6 border-l-2">
            <div className="space-y-2">
              <Label htmlFor="metric_4_custom_label" className="text-xs">Label</Label>
              <Input
                id="metric_4_custom_label"
                placeholder="e.g., Gross Margin, ARR Growth"
                {...form.register('metric_4_custom_label')}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metric_4_custom_value" className="text-xs">Value</Label>
              <Input
                id="metric_4_custom_value"
                placeholder="e.g., 45%, $2.5M"
                {...form.register('metric_4_custom_value')}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metric_4_custom_subtitle" className="text-xs">Subtitle (optional)</Label>
              <Input
                id="metric_4_custom_subtitle"
                placeholder="e.g., Industry leading, Year over year"
                {...form.register('metric_4_custom_subtitle')}
                className="text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
