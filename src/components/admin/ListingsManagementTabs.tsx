import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ListingsTabContent } from './ListingsTabContent';
import { ListingForm } from './ListingForm';
import { AdminListing } from '@/types/admin';
import { useAdmin } from '@/hooks/use-admin';

const ListingsManagementTabs = () => {
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<AdminListing | null>(null);

  const { useCreateListing, useUpdateListing } = useAdmin();
  const { mutateAsync: createListing, isPending: isCreating } = useCreateListing();
  const { mutateAsync: updateListing, isPending: isUpdating } = useUpdateListing();

  const handleFormSubmit = async (data: any, image?: File | null, sendDealAlerts?: boolean) => {
    try {
      if (editingListing) {
        await updateListing({ id: editingListing.id, listing: data, image });
      } else {
        await createListing({ listing: data, image, sendDealAlerts, targetType: 'marketplace' });
      }
      handleFormClose();
    } catch (error) {
      console.error('[FORM SUBMIT] Mutation failed:', error);
    }
  };

  const handleFormClose = () => {
    setIsCreateFormOpen(false);
    setEditingListing(null);
  };

  if (isCreateFormOpen || editingListing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <ListingForm
          listing={editingListing ?? undefined}
          onSubmit={handleFormSubmit}
          isLoading={isCreating || isUpdating}
          targetType="marketplace"
        />
        <div className="mt-6">
          <Button variant="outline" onClick={handleFormClose}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-light text-foreground tracking-tight">
              Listings Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage marketplace listings with enterprise-grade tools
            </p>
          </div>
          {/* Listings are created from the Marketplace Queue */}
        </div>

        {/* Marketplace Listings */}
        <ListingsTabContent
          type="marketplace"
          onEdit={setEditingListing}
          onCreateNew={() => setIsCreateFormOpen(true)}
        />
      </div>
    </div>
  );
};

export default ListingsManagementTabs;
