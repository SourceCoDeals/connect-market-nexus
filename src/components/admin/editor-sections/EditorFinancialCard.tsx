import { FormField, FormItem, FormControl, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UseFormReturn } from "react-hook-form";
import { EnhancedCurrencyInput } from "@/components/ui/enhanced-currency-input";
import { EDITOR_DESIGN } from "@/lib/editor-design-system";
import { cn } from "@/lib/utils";

interface EditorFinancialCardProps {
  form: UseFormReturn<any>;
}

export function EditorFinancialCard({ form }: EditorFinancialCardProps) {
  const metric3Type = form.watch('metric_3_type') || 'employees';
  const metric4Type = form.watch('metric_4_type') || 'ebitda_margin';
  const revenue = form.watch('revenue') || 0;
  const ebitda = form.watch('ebitda') || 0;
  const calculatedMargin = revenue > 0 ? ((ebitda / revenue) * 100).toFixed(1) : '0.0';

  return (
    <div className={cn(EDITOR_DESIGN.cardBg, EDITOR_DESIGN.cardBorder, "rounded-lg", EDITOR_DESIGN.cardPadding)}>
      <div className={cn(EDITOR_DESIGN.microHeader, "mb-4")}>
        Financial
      </div>
      
      {/* Primary metrics row */}
      <div className="grid grid-cols-[1fr_1fr_180px] gap-6 mb-6">
        {/* Revenue */}
        <div className={EDITOR_DESIGN.compactFieldSpacing}>
          <div className={EDITOR_DESIGN.microLabel}>Revenue</div>
          <FormField
            control={form.control}
            name="revenue"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <EnhancedCurrencyInput
                    value={field.value?.toString() || ''}
                    onChange={(value) => field.onChange(Number(value))}
                    currencyMode="auto"
                    fieldType="revenue"
                    showSuffix={true}
                    className={cn(EDITOR_DESIGN.compactHeight, "text-sm font-medium", EDITOR_DESIGN.inputBg)}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <input
            placeholder="Subtitle"
            {...form.register('revenue_metric_subtitle')}
            className={cn(
              EDITOR_DESIGN.microHeight,
              "w-full text-xs bg-transparent border-0 border-b border-dashed border-border/50 px-0 placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
            )}
          />
        </div>
        
        {/* EBITDA */}
        <div className={EDITOR_DESIGN.compactFieldSpacing}>
          <div className={EDITOR_DESIGN.microLabel}>EBITDA</div>
          <FormField
            control={form.control}
            name="ebitda"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <EnhancedCurrencyInput
                    value={field.value?.toString() || ''}
                    onChange={(value) => field.onChange(Number(value))}
                    currencyMode="auto"
                    fieldType="revenue"
                    showSuffix={true}
                    className={cn(EDITOR_DESIGN.compactHeight, "text-sm font-medium", EDITOR_DESIGN.inputBg)}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <div className="flex items-center gap-2">
            <input
              placeholder="Subtitle"
              {...form.register('ebitda_metric_subtitle')}
              className={cn(
                EDITOR_DESIGN.microHeight,
                "flex-1 text-xs bg-transparent border-0 border-b border-dashed border-border/50 px-0 placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
              )}
            />
            <span className="text-xs font-medium text-primary tabular-nums">
              {calculatedMargin}%
            </span>
          </div>
        </div>
        
        {/* Team */}
        <div className={EDITOR_DESIGN.compactFieldSpacing}>
          <div className={EDITOR_DESIGN.microLabel}>Team Size</div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="FT"
              {...form.register('full_time_employees', { valueAsNumber: true })}
              className={cn(EDITOR_DESIGN.compactHeight, "text-sm", EDITOR_DESIGN.inputBg)}
            />
            <span className="text-muted-foreground/50">+</span>
            <Input
              type="number"
              placeholder="PT"
              {...form.register('part_time_employees', { valueAsNumber: true })}
              className={cn(EDITOR_DESIGN.compactHeight, "text-sm", EDITOR_DESIGN.inputBg)}
            />
          </div>
        </div>
      </div>
      
      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-4 pb-6 mb-6 border-b border-border/30">
        {/* Metric 3 */}
        <div className="flex items-start justify-between">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn(EDITOR_DESIGN.microLabel)}>Metric 3</span>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => form.setValue('metric_3_type', 'employees')}
                  className={cn(
                    EDITOR_DESIGN.toggleButton,
                    metric3Type === 'employees' ? EDITOR_DESIGN.toggleButtonActive : EDITOR_DESIGN.toggleButtonInactive
                  )}
                >
                  Team
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue('metric_3_type', 'custom')}
                  className={cn(
                    EDITOR_DESIGN.toggleButton,
                    metric3Type === 'custom' ? EDITOR_DESIGN.toggleButtonActive : EDITOR_DESIGN.toggleButtonInactive
                  )}
                >
                  Custom
                </button>
              </div>
            </div>
            {metric3Type === 'custom' && (
              <div className="space-y-1.5 pt-1">
                <Input
                  placeholder="Label"
                  {...form.register('metric_3_custom_label')}
                  className={cn(EDITOR_DESIGN.miniHeight, EDITOR_DESIGN.compactInputText, EDITOR_DESIGN.inputBg)}
                />
                <Input
                  placeholder="Value"
                  {...form.register('metric_3_custom_value')}
                  className={cn(EDITOR_DESIGN.miniHeight, EDITOR_DESIGN.compactInputText, EDITOR_DESIGN.inputBg)}
                />
                <Input
                  placeholder="Subtitle (optional)"
                  {...form.register('metric_3_custom_subtitle')}
                  className={cn(EDITOR_DESIGN.microHeight, EDITOR_DESIGN.compactInputText, EDITOR_DESIGN.inputBg, "border-dashed")}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Metric 4 */}
        <div className="flex items-start justify-between">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn(EDITOR_DESIGN.microLabel)}>Metric 4</span>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => form.setValue('metric_4_type', 'ebitda_margin')}
                  className={cn(
                    EDITOR_DESIGN.toggleButton,
                    metric4Type === 'ebitda_margin' ? EDITOR_DESIGN.toggleButtonActive : EDITOR_DESIGN.toggleButtonInactive
                  )}
                >
                  Margin
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue('metric_4_type', 'custom')}
                  className={cn(
                    EDITOR_DESIGN.toggleButton,
                    metric4Type === 'custom' ? EDITOR_DESIGN.toggleButtonActive : EDITOR_DESIGN.toggleButtonInactive
                  )}
                >
                  Custom
                </button>
              </div>
            </div>
            {metric4Type === 'custom' && (
              <div className="space-y-1.5 pt-1">
                <Input
                  placeholder="Label"
                  {...form.register('metric_4_custom_label')}
                  className={cn(EDITOR_DESIGN.miniHeight, EDITOR_DESIGN.compactInputText, EDITOR_DESIGN.inputBg)}
                />
                <Input
                  placeholder="Value"
                  {...form.register('metric_4_custom_value')}
                  className={cn(EDITOR_DESIGN.miniHeight, EDITOR_DESIGN.compactInputText, EDITOR_DESIGN.inputBg)}
                />
                <Input
                  placeholder="Subtitle (optional)"
                  {...form.register('metric_4_custom_subtitle')}
                  className={cn(EDITOR_DESIGN.microHeight, EDITOR_DESIGN.compactInputText, EDITOR_DESIGN.inputBg, "border-dashed")}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Context */}
      <div className="space-y-2">
        <div className={EDITOR_DESIGN.microLabel}>Investment Context (internal)</div>
        <Textarea
          rows={2}
          placeholder="Why is this a good deal? Key thesis points..."
          {...form.register('owner_notes')}
          className={cn("text-xs resize-none", EDITOR_DESIGN.inputBg, EDITOR_DESIGN.inputBorder, "rounded p-2")}
        />
      </div>
    </div>
  );
}
