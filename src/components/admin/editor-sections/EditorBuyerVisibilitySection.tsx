import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import { Eye, EyeOff, Users } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { BUYER_TYPE_OPTIONS } from "@/lib/signup-field-options";
import { useState } from "react";

interface EditorBuyerVisibilitySectionProps {
  form: UseFormReturn<any>;
}

export function EditorBuyerVisibilitySection({ form }: EditorBuyerVisibilitySectionProps) {
  const visibleToBuyerTypes = form.watch('visible_to_buyer_types');
  const [restrictionMode, setRestrictionMode] = useState<'all' | 'restrict'>(
    visibleToBuyerTypes && visibleToBuyerTypes.length > 0 ? 'restrict' : 'all'
  );

  const handleModeChange = (mode: 'all' | 'restrict') => {
    setRestrictionMode(mode);
    if (mode === 'all') {
      form.setValue('visible_to_buyer_types', null);
    } else {
      form.setValue('visible_to_buyer_types', []);
    }
  };

  const handleBuyerTypeToggle = (buyerType: string, checked: boolean) => {
    const current = visibleToBuyerTypes || [];
    if (checked) {
      form.setValue('visible_to_buyer_types', [...current, buyerType]);
    } else {
      form.setValue('visible_to_buyer_types', current.filter((t: string) => t !== buyerType));
    }
  };

  const selectedCount = visibleToBuyerTypes?.length || 0;
  const totalCount = BUYER_TYPE_OPTIONS.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-sourceco-muted">
          <Eye className="h-5 w-5 text-sourceco-accent" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground">Buyer Visibility</h3>
          <p className="text-sm text-muted-foreground">Control which buyer types can see this listing</p>
        </div>
      </div>

      <FormField
        control={form.control}
        name="visible_to_buyer_types"
        render={() => (
          <FormItem>
            <div className="space-y-4">
              <RadioGroup 
                value={restrictionMode} 
                onValueChange={handleModeChange}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:bg-sourceco-muted/50 transition-colors">
                  <RadioGroupItem value="all" id="visibility-all" />
                  <div className="flex-1 space-y-1">
                    <label
                      htmlFor="visibility-all"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                    >
                      <Users className="h-4 w-4 text-success" />
                      Visible to All Buyer Types
                      <Badge variant="outline" className="ml-2 bg-success/10 text-success border-success/20">
                        Default
                      </Badge>
                    </label>
                    <p className="text-sm text-muted-foreground">
                      This listing will appear in the marketplace for all approved buyers
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:bg-sourceco-muted/50 transition-colors">
                  <RadioGroupItem value="restrict" id="visibility-restrict" />
                  <div className="flex-1 space-y-1">
                    <label
                      htmlFor="visibility-restrict"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                    >
                      <EyeOff className="h-4 w-4 text-warning" />
                      Restrict to Specific Buyer Types
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Only selected buyer types will be able to view this listing
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {restrictionMode === 'restrict' && (
                <div className="space-y-4 animate-in fade-in-50 slide-in-from-top-2">
                  <div className="flex items-center justify-between py-2">
                    <FormLabel className="text-sm font-medium">
                      Select buyer types who CAN view this listing:
                    </FormLabel>
                    {selectedCount > 0 && (
                      <Badge variant="outline" className="bg-info/10 text-info border-info/20">
                        {selectedCount} of {totalCount} selected
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-lg bg-sourceco-muted/30 border border-border">
                    {BUYER_TYPE_OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        className="flex items-start space-x-3 p-3 rounded-md hover:bg-background transition-colors"
                      >
                        <Checkbox
                          id={`buyer-type-${option.value}`}
                          checked={visibleToBuyerTypes?.includes(option.value) || false}
                          onCheckedChange={(checked) => 
                            handleBuyerTypeToggle(option.value, checked as boolean)
                          }
                        />
                        <div className="flex-1 space-y-1">
                          <label
                            htmlFor={`buyer-type-${option.value}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {option.label}
                          </label>
                          <p className="text-xs text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedCount === 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                      <EyeOff className="h-4 w-4 text-warning" />
                      <p className="text-sm text-warning">
                        Please select at least one buyer type, or choose "Visible to All"
                      </p>
                    </div>
                  )}

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
                    <div className="mt-0.5">
                      <svg className="h-4 w-4 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-info">Visibility Impact</p>
                      <p className="text-xs text-info/90">
                        This listing will only appear in the marketplace for the selected buyer types. 
                        Other buyer types won't see it in search results or the listings page.
                        Admins will always see all listings regardless of restrictions.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
