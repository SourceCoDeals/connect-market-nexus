import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { EnhancedMultiCategorySelect } from "@/components/ui/enhanced-category-select";
import { EnhancedMultiLocationSelect } from "@/components/ui/enhanced-location-select";
import { cn } from "@/lib/utils";
import { EDITOR_DESIGN } from "@/lib/editor-design-system";

interface EditorCoreDetailsSectionProps {
  form: UseFormReturn<any>;
}

export function EditorCoreDetailsSection({ form }: EditorCoreDetailsSectionProps) {
  const acquisitionType = form.watch('acquisition_type');

  return (
    <div className={EDITOR_DESIGN.sectionSpacing}>
      <div className="pb-3 mb-4 border-b border-border/40">
        <h3 className="text-sm font-medium text-foreground">Core Details</h3>
      </div>

      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={EDITOR_DESIGN.fieldLabel}>Business Title</FormLabel>
            <FormControl>
              <Input 
                placeholder="E.g., Profitable SaaS Platform with Recurring Revenue" 
                className={cn(EDITOR_DESIGN.standardHeight, EDITOR_DESIGN.focusRing, EDITOR_DESIGN.hoverTransition)} 
                {...field} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className={`grid grid-cols-1 lg:grid-cols-3 ${EDITOR_DESIGN.fieldSpacing}`}>
        <FormField
          control={form.control}
          name="categories"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={EDITOR_DESIGN.fieldLabel}>Industries</FormLabel>
              <FormControl>
                <EnhancedMultiCategorySelect
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Select up to 2..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={EDITOR_DESIGN.fieldLabel}>Location</FormLabel>
              <FormControl>
                <EnhancedMultiLocationSelect
                  value={field.value ? [field.value] : []}
                  onValueChange={(values) => field.onChange(values[0] || "")}
                  placeholder="Primary location..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="acquisition_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={EDITOR_DESIGN.fieldLabel}>Acquisition Type</FormLabel>
              <FormControl>
                <div className="inline-flex items-center w-full rounded-lg border border-border bg-muted/30 p-1">
                  <button
                    type="button"
                    onClick={() => field.onChange('platform')}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-sm font-medium rounded-md",
                      EDITOR_DESIGN.transition,
                      field.value === 'platform'
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Platform
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange('add_on')}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-sm font-medium rounded-md",
                      EDITOR_DESIGN.transition,
                      field.value === 'add_on'
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Add-on
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange('none')}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-sm font-medium rounded-md",
                      EDITOR_DESIGN.transition,
                      !field.value || field.value === 'none'
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    None
                  </button>
                </div>
              </FormControl>
              <p className={cn(EDITOR_DESIGN.helperText, "mt-1.5")}>
                Platform: Foundation • Add-on: Complement
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

    </div>
  );
}
