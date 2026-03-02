// React is auto-imported via JSX transform
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { CreateDealModalProps } from './schema';
import { useCreateDealForm } from './useCreateDealForm';
import { AutoPopulationNotice } from './AutoPopulationNotice';
import { BasicInfoSection } from './BasicInfoSection';
import { ContactInfoSection } from './ContactInfoSection';
import { AdditionalDetailsSection } from './AdditionalDetailsSection';
import { DuplicateWarningDialog } from './DuplicateWarningDialog';

export function CreateDealModal({
  open,
  onOpenChange,
  prefilledStageId,
  onDealCreated,
}: CreateDealModalProps) {
  const {
    form,
    stages,
    listings,
    adminUsers,
    marketplaceUsers,
    marketplaceCompanies,
    createDealMutation,
    duplicates,
    showDuplicateWarning,
    setShowDuplicateWarning,
    isCheckingDuplicates,
    isSelectingUser,
    selectedUserId,
    selectedCompanyName,
    autoPopulatedFrom,
    setAutoPopulatedFrom,
    userOptions,
    handleFormSubmit,
    handleCreateAnyway,
    handleCancelDuplicate,
    handleUserSelect,
    handleToggleUserSelection,
    handleCompanySelect,
  } = useCreateDealForm(open, onOpenChange, prefilledStageId, onDealCreated);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] md:max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
            <DialogDescription>
              Add a new deal to your pipeline. All deals must be associated with a listing.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
              {/* Auto-Population Notice */}
              {autoPopulatedFrom && (
                <AutoPopulationNotice
                  autoPopulatedFrom={autoPopulatedFrom}
                  form={form}
                  onDismiss={() => setAutoPopulatedFrom(null)}
                />
              )}

              {/* Basic Information */}
              <BasicInfoSection form={form} listings={listings} stages={stages} />

              {/* Contact Information */}
              <ContactInfoSection
                form={form}
                isSelectingUser={isSelectingUser}
                selectedUserId={selectedUserId}
                selectedCompanyName={selectedCompanyName}
                marketplaceUsers={marketplaceUsers as { id: string; buyer_type?: string }[]}
                marketplaceCompanies={marketplaceCompanies}
                userOptions={userOptions}
                handleUserSelect={handleUserSelect}
                handleToggleUserSelection={handleToggleUserSelection}
                handleCompanySelect={handleCompanySelect}
              />

              {/* Additional Details */}
              <AdditionalDetailsSection form={form} adminUsers={adminUsers} />

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={createDealMutation.isPending || isCheckingDuplicates}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createDealMutation.isPending || isCheckingDuplicates}
                >
                  {(createDealMutation.isPending || isCheckingDuplicates) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isCheckingDuplicates ? 'Checking...' : 'Create Deal'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Warning Dialog */}
      <DuplicateWarningDialog
        open={showDuplicateWarning}
        onOpenChange={setShowDuplicateWarning}
        duplicates={duplicates}
        onCreateAnyway={handleCreateAnyway}
        onCancel={handleCancelDuplicate}
      />
    </>
  );
}
