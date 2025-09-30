import { Control } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InvestmentDetailsStepProps {
  control: Control<any>;
}

export function InvestmentDetailsStep({ control }: InvestmentDetailsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Investment Details</h2>
        <p className="text-muted-foreground">
          Additional notes and context for potential investors
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          This section is for internal notes that help your team understand the deal context,
          seller motivations, and any special considerations. Not visible to buyers.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <FormField
            control={control}
            name="owner_notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Internal Notes & Context
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Add any internal notes about the business, seller motivations, special considerations, deal timeline, or other important context..."
                    className="min-h-[200px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  These notes are only visible to admins and help provide context for your team
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
            <strong>What to include:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Seller's motivation and timeline</li>
              <li>Unique aspects of the business or transaction</li>
              <li>Key considerations for potential buyers</li>
              <li>Deal structure preferences</li>
              <li>Any special circumstances or requirements</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
