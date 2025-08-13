import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Shield, Link as LinkIcon, User, Building, FileText, Clipboard } from "lucide-react";
import { Control } from "react-hook-form";
import { processUrl, isValidUrlFormat } from "@/lib/url-utils";

interface InternalCompanyInfoSectionProps {
  control: Control<any>;
  dealIdentifier?: string;
}

export function InternalCompanyInfoSection({ control, dealIdentifier }: InternalCompanyInfoSectionProps) {
  return (
    <Card className="border-slate-200 bg-slate-50/30 dark:border-slate-700 dark:bg-slate-900/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Shield className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          Internal Company Information
          <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
            Admin Only
          </span>
        </CardTitle>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This information is only visible to admins and helps identify the actual company behind anonymous listings.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Deal Identifier - Read-only display */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Clipboard className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Deal Identifier</span>
          </div>
          <code className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded border text-slate-800 dark:text-slate-200">
            {dealIdentifier || "Will be auto-generated"}
          </code>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
            Unique identifier for tracking this deal across systems
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="internal_company_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Real Company Name
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., Acme Corporation" 
                    {...field} 
                    className="border-slate-200 focus:border-slate-400 dark:border-slate-700 dark:focus:border-slate-500"
                  />
                </FormControl>
                <FormDescription>
                  The actual company name behind this anonymous listing
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="internal_primary_owner"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Primary Owner/Lead
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., John Smith (our team member)"
                    {...field}
                    className="border-slate-200 focus:border-slate-400 dark:border-slate-700 dark:focus:border-slate-500"
                  />
                </FormControl>
                <FormDescription>
                  Team member responsible for this deal
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="internal_salesforce_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Salesforce Link
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="www.salesforce.com/deal/... or full URL"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (isValidUrlFormat(value)) {
                        field.onChange(processUrl(value));
                      } else {
                        field.onChange(value);
                      }
                    }}
                    className="border-slate-200 focus:border-slate-400 dark:border-slate-700 dark:focus:border-slate-500"
                  />
                </FormControl>
                <FormDescription>
                  Direct link to Salesforce opportunity (https:// will be added automatically)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="internal_deal_memo_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Deal Memo Link
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="www.company.webflow.io/deal-memo/... or full URL"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (isValidUrlFormat(value)) {
                        field.onChange(processUrl(value));
                      } else {
                        field.onChange(value);
                      }
                    }}
                    className="border-slate-200 focus:border-slate-400 dark:border-slate-700 dark:focus:border-slate-500"
                  />
                </FormControl>
                <FormDescription>
                  Link to deal memo on your website (https:// will be added automatically)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={control}
          name="internal_contact_info"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Information</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Key contacts, phone numbers, email addresses, etc."
                    className="min-h-[80px] border-slate-200 focus:border-slate-400 dark:border-slate-700 dark:focus:border-slate-500"
                    {...field}
                  />
                </FormControl>
              <FormDescription>
                Important contact details for this deal
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="internal_notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Internal Notes</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Additional internal notes, context, meeting notes, etc."
                    className="min-h-[100px] border-slate-200 focus:border-slate-400 dark:border-slate-700 dark:focus:border-slate-500"
                    {...field}
                  />
                </FormControl>
              <FormDescription>
                Any additional context or notes for the team
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}