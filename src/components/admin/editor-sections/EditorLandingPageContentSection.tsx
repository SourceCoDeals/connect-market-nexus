import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EDITOR_DESIGN } from "@/lib/editor-design-system";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { useState } from "react";

interface EditorLandingPageContentSectionProps {
  form: UseFormReturn<any>;
}

export function EditorLandingPageContentSection({ form }: EditorLandingPageContentSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const customSections: Array<{ title: string; description: string }> = form.watch('custom_sections') || [];
  const services: string[] = form.watch('services') || [];

  const addCustomSection = () => {
    const current = form.getValues('custom_sections') || [];
    form.setValue('custom_sections', [...current, { title: '', description: '' }]);
  };

  const removeCustomSection = (index: number) => {
    const current = form.getValues('custom_sections') || [];
    form.setValue('custom_sections', current.filter((_: any, i: number) => i !== index));
  };

  const updateCustomSection = (index: number, field: 'title' | 'description', value: string) => {
    const current = [...(form.getValues('custom_sections') || [])];
    current[index] = { ...current[index], [field]: value };
    form.setValue('custom_sections', current);
  };

  const addService = () => {
    const current = form.getValues('services') || [];
    form.setValue('services', [...current, '']);
  };

  const removeService = (index: number) => {
    const current = form.getValues('services') || [];
    form.setValue('services', current.filter((_: any, i: number) => i !== index));
  };

  const updateService = (index: number, value: string) => {
    const current = [...(form.getValues('services') || [])];
    current[index] = value;
    form.setValue('services', current);
  };

  return (
    <div className={cn(EDITOR_DESIGN.cardBg, EDITOR_DESIGN.cardBorder, "rounded-lg", EDITOR_DESIGN.cardPadding)}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className={cn(EDITOR_DESIGN.microHeader)}>Landing Page Content</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {form.watch('investment_thesis') ? 'Has content' : 'Empty'}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Investment Thesis */}
          <div className={EDITOR_DESIGN.microFieldSpacing}>
            <div className={EDITOR_DESIGN.microLabel}>Investment Thesis</div>
            <FormField
              control={form.control}
              name="investment_thesis"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Why this is a compelling acquisition opportunity..."
                      {...field}
                      value={field.value || ''}
                      className={cn("text-sm resize-y", EDITOR_DESIGN.inputBg, EDITOR_DESIGN.inputBorder, "rounded p-2")}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Custom Sections */}
          <div className={cn("pt-3", EDITOR_DESIGN.subtleDivider)}>
            <div className="flex items-center justify-between mb-2">
              <div className={EDITOR_DESIGN.microLabel}>Content Sections</div>
              <Button type="button" variant="ghost" size="sm" onClick={addCustomSection} className="h-6 gap-1 text-xs">
                <Plus className="h-3 w-3" /> Add Section
              </Button>
            </div>
            {customSections.map((section, i) => (
              <div key={i} className="mb-3 p-3 border border-border/30 rounded-md relative">
                <button
                  type="button"
                  onClick={() => removeCustomSection(i)}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <Input
                  placeholder="Section title"
                  value={section.title}
                  onChange={(e) => updateCustomSection(i, 'title', e.target.value)}
                  className={cn("mb-2 text-sm", EDITOR_DESIGN.miniHeight, EDITOR_DESIGN.inputBg)}
                />
                <Textarea
                  rows={2}
                  placeholder="Section content..."
                  value={section.description}
                  onChange={(e) => updateCustomSection(i, 'description', e.target.value)}
                  className={cn("text-sm resize-y", EDITOR_DESIGN.inputBg, EDITOR_DESIGN.inputBorder, "rounded p-2")}
                />
              </div>
            ))}
          </div>

          {/* Services */}
          <div className={cn("pt-3", EDITOR_DESIGN.subtleDivider)}>
            <div className="flex items-center justify-between mb-2">
              <div className={EDITOR_DESIGN.microLabel}>Services / Offerings</div>
              <Button type="button" variant="ghost" size="sm" onClick={addService} className="h-6 gap-1 text-xs">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            <div className="space-y-1.5">
              {services.map((service, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    placeholder="Service or offering"
                    value={service}
                    onChange={(e) => updateService(i, e.target.value)}
                    className={cn("flex-1 text-sm", EDITOR_DESIGN.miniHeight, EDITOR_DESIGN.inputBg)}
                  />
                  <button type="button" onClick={() => removeService(i)} className="text-muted-foreground hover:text-destructive p-1">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Business Details Grid */}
          <div className={cn("pt-3", EDITOR_DESIGN.subtleDivider, "grid grid-cols-2 gap-3")}>
            <div className={EDITOR_DESIGN.microFieldSpacing}>
              <div className={EDITOR_DESIGN.microLabel}>Business Model</div>
              <FormField
                control={form.control}
                name="business_model"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="e.g., Recurring revenue" {...field} value={field.value || ''} className={cn("text-sm", EDITOR_DESIGN.miniHeight, EDITOR_DESIGN.inputBg)} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className={EDITOR_DESIGN.microFieldSpacing}>
              <div className={EDITOR_DESIGN.microLabel}>Customer Geography</div>
              <FormField
                control={form.control}
                name="customer_geography"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="e.g., Southeast US" {...field} value={field.value || ''} className={cn("text-sm", EDITOR_DESIGN.miniHeight, EDITOR_DESIGN.inputBg)} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className={EDITOR_DESIGN.microFieldSpacing}>
              <div className={EDITOR_DESIGN.microLabel}>Customer Types</div>
              <FormField
                control={form.control}
                name="customer_types"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="e.g., B2B, Commercial" {...field} value={field.value || ''} className={cn("text-sm", EDITOR_DESIGN.miniHeight, EDITOR_DESIGN.inputBg)} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className={EDITOR_DESIGN.microFieldSpacing}>
              <div className={EDITOR_DESIGN.microLabel}>Revenue Model</div>
              <FormField
                control={form.control}
                name="revenue_model"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="e.g., Contract-based" {...field} value={field.value || ''} className={cn("text-sm", EDITOR_DESIGN.miniHeight, EDITOR_DESIGN.inputBg)} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Ownership / Seller */}
          <div className={cn("pt-3", EDITOR_DESIGN.subtleDivider, "grid grid-cols-2 gap-3")}>
            <div className={EDITOR_DESIGN.microFieldSpacing}>
              <div className={EDITOR_DESIGN.microLabel}>Ownership Structure</div>
              <FormField
                control={form.control}
                name="ownership_structure"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="e.g., Founder-owned, 20+ years" {...field} value={field.value || ''} className={cn("text-sm", EDITOR_DESIGN.miniHeight, EDITOR_DESIGN.inputBg)} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className={EDITOR_DESIGN.microFieldSpacing}>
              <div className={EDITOR_DESIGN.microLabel}>Seller Motivation</div>
              <FormField
                control={form.control}
                name="seller_motivation"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="e.g., Retirement, succession" {...field} value={field.value || ''} className={cn("text-sm", EDITOR_DESIGN.miniHeight, EDITOR_DESIGN.inputBg)} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Competitive Position & End Market */}
          <div className={cn("pt-3", EDITOR_DESIGN.subtleDivider, "space-y-3")}>
            <div className={EDITOR_DESIGN.microFieldSpacing}>
              <div className={EDITOR_DESIGN.microLabel}>Competitive Position</div>
              <FormField
                control={form.control}
                name="competitive_position"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Market position, differentiation, moat..."
                        {...field}
                        value={field.value || ''}
                        className={cn("text-sm resize-y", EDITOR_DESIGN.inputBg, EDITOR_DESIGN.inputBorder, "rounded p-2")}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className={EDITOR_DESIGN.microFieldSpacing}>
              <div className={EDITOR_DESIGN.microLabel}>End Market Description</div>
              <FormField
                control={form.control}
                name="end_market_description"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Target market, industry dynamics..."
                        {...field}
                        value={field.value || ''}
                        className={cn("text-sm resize-y", EDITOR_DESIGN.inputBg, EDITOR_DESIGN.inputBorder, "rounded p-2")}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
