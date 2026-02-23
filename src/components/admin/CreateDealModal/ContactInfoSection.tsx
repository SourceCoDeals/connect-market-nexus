// React is auto-imported via JSX transform
import { UseFormReturn } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, UserPlus } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { CreateDealFormData } from './schema';

interface ContactInfoSectionProps {
  form: UseFormReturn<CreateDealFormData>;
  isSelectingUser: boolean;
  selectedUserId: string | null;
  selectedCompanyName: string | null;
  marketplaceUsers: any[] | undefined;
  marketplaceCompanies: any[] | undefined;
  userOptions: { value: string; label: string; searchTerms: string }[];
  handleUserSelect: (userId: string) => void;
  handleToggleUserSelection: () => void;
  handleCompanySelect: (companyName: string) => void;
}

export function ContactInfoSection({
  form,
  isSelectingUser,
  selectedUserId,
  selectedCompanyName,
  marketplaceUsers,
  marketplaceCompanies,
  userOptions,
  handleUserSelect,
  handleToggleUserSelection,
  handleCompanySelect,
}: ContactInfoSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Contact Information</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isSelectingUser
              ? 'Select an existing marketplace user or switch to manual entry'
              : 'Enter contact details manually or select an existing user'
            }
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleToggleUserSelection}
          className="gap-2"
        >
          {isSelectingUser ? (
            <>
              <UserPlus className="h-4 w-4" />
              New Contact
            </>
          ) : (
            <>
              <User className="h-4 w-4" />
              Select User
            </>
          )}
        </Button>
      </div>

      {isSelectingUser ? (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Marketplace User *</label>
            <Combobox
              options={userOptions}
              value={selectedUserId || ''}
              onValueChange={handleUserSelect}
              placeholder="Search by name, email, or company..."
              emptyText="No marketplace users found"
              searchPlaceholder="Search users..."
            />
            {selectedUserId && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-xs">
                  {marketplaceUsers?.find(u => u.id === selectedUserId)?.buyer_type || 'Buyer'}
                </Badge>
                <span>User will be linked to this deal</span>
              </div>
            )}
          </div>

          {selectedUserId && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Contact Name</label>
                <Input value={form.watch('contact_name')} disabled className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <Input value={form.watch('contact_email')} disabled className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Company</label>
                <Input value={form.watch('contact_company')} disabled className="bg-muted/50" />
              </div>
            </div>
          )}
        </>
      ) : (
        <>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contact_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Name *</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contact_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="john@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contact_company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <div className="space-y-2">
                  <FormControl>
                    <Combobox
                      options={marketplaceCompanies?.map(c => ({
                        value: c.value,
                        label: c.label,
                        searchTerms: c.searchTerms,
                      })) || []}
                      value={field.value || ''}
                      onValueChange={(value) => {
                        handleCompanySelect(value);
                        field.onChange(value);
                      }}
                      placeholder="Select or type company name..."
                      emptyText="No companies found"
                      searchPlaceholder="Search companies..."
                      allowCustomValue={true}
                      onCustomValueCreate={() => {}}
                    />
                  </FormControl>

                  {/* Show metadata if existing company selected */}
                  {selectedCompanyName && marketplaceCompanies && (() => {
                    const companyData = marketplaceCompanies.find(c => c.value === selectedCompanyName);
                    if (!companyData) return null;

                    return (
                      <div className="text-xs bg-muted/50 p-2 rounded-md space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {companyData.userCount} existing user{companyData.userCount !== 1 ? 's' : ''}
                          </Badge>
                          {companyData.buyerTypes.map((type: string) => (
                            <Badge key={type} variant="secondary" className="text-xs capitalize">
                              {type}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-muted-foreground">
                          Users: {companyData.userEmails.slice(0, 3).join(', ')}
                          {companyData.userEmails.length > 3 && ` +${companyData.userEmails.length - 3} more`}
                        </div>
                      </div>
                    );
                  })()}

                  <FormDescription className="text-xs">
                    Select an existing company or type a new one
                  </FormDescription>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contact_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="+1 (555) 000-0000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="contact_role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role/Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., CEO, Managing Partner" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
          </>
        )}
    </div>
  );
}
