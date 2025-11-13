import { useState } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Building, User, Link as LinkIcon, FileText, Clipboard, ChevronDown } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { processUrl, isValidUrlFormat } from "@/lib/url-utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useSourceCoAdmins } from "@/hooks/admin/use-source-co-admins";

interface EditorInternalSectionProps {
  form: UseFormReturn<any>;
  dealIdentifier?: string;
}

export function EditorInternalSection({ form, dealIdentifier }: EditorInternalSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: sourceCoAdmins, isLoading: loadingAdmins } = useSourceCoAdmins();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border-2 border-sourceco-accent/20 bg-sourceco-muted/30 overflow-hidden">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-6 hover:bg-sourceco-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sourceco-accent/10">
                <Shield className="h-5 w-5 text-sourceco-accent" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                  Internal Company Information
                  <span className="text-xs font-normal bg-sourceco-accent/20 text-sourceco-accent px-2.5 py-1 rounded-full border border-sourceco-accent/30">
                    Admin Only
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Confidential data for deal tracking and CRM integration
                </p>
              </div>
            </div>
            <ChevronDown className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="px-6 pb-6">
          <Tabs defaultValue="company" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="company">Company Details</TabsTrigger>
              <TabsTrigger value="crm">CRM Integration</TabsTrigger>
              <TabsTrigger value="notes">Notes & Context</TabsTrigger>
            </TabsList>

            <TabsContent value="company" className="space-y-6">
              <div className="bg-background/50 p-4 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Clipboard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Deal Identifier</span>
                </div>
                <code className="text-sm font-mono bg-muted px-3 py-1.5 rounded border text-foreground block">
                  {dealIdentifier || "Will be auto-generated upon creation"}
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Unique identifier for tracking this deal across systems
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
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
                          className="bg-background border-border"
                        />
                      </FormControl>
                      <FormDescription>
                        The actual company name behind this listing
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="primary_owner_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Primary Owner/Lead
                      </FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || undefined}
                        disabled={loadingAdmins}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue placeholder={loadingAdmins ? "Loading team members..." : "Select team member..."} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sourceCoAdmins?.map((admin) => (
                            <SelectItem key={admin.id} value={admin.id}>
                              {admin.displayName} ({admin.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        SourceCo/CapTarget employee who owns the relationship with the business owner
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>

            <TabsContent value="crm" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="internal_salesforce_link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        Salesforce Link
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="salesforce.com/deal/..."
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (isValidUrlFormat(value)) {
                              field.onChange(processUrl(value));
                            } else {
                              field.onChange(value);
                            }
                          }}
                          className="bg-background border-border"
                        />
                      </FormControl>
                      <FormDescription>
                        Direct link to Salesforce opportunity
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="internal_deal_memo_link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Deal Memo Link
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="company.com/deal-memo/..."
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (isValidUrlFormat(value)) {
                              field.onChange(processUrl(value));
                            } else {
                              field.onChange(value);
                            }
                          }}
                          className="bg-background border-border"
                        />
                      </FormControl>
                      <FormDescription>
                        Link to internal deal memo
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="internal_contact_info"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Information</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Key contacts, phone numbers, email addresses..."
                        className="min-h-[100px] bg-background border-border resize-none"
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
            </TabsContent>

            <TabsContent value="notes" className="space-y-6">
              <FormField
                control={form.control}
                name="internal_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Meeting notes, deal context, key considerations, competitive landscape..."
                        className="min-h-[200px] bg-background border-border resize-none"
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
            </TabsContent>
          </Tabs>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
