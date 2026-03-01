import { AdminListing } from '@/types/admin';
import { ImprovedListingEditor } from './ImprovedListingEditor';

interface ListingFormProps {
  onSubmit: (data: Record<string, unknown>, image?: File | null) => Promise<void>;
  listing?: AdminListing;
  isLoading?: boolean;
  targetType?: 'marketplace' | 'research';
}

export function ListingForm(props: ListingFormProps) {
  // Forward to improved editor
  return <ImprovedListingEditor {...props} />;
}
