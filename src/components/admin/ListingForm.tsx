import { AdminListing } from "@/types/admin";
import { ImprovedListingEditor } from "./ImprovedListingEditor";

interface ListingFormProps {
  onSubmit: (data: any, image?: File | null) => Promise<void>;
  listing?: AdminListing;
  isLoading?: boolean;
  targetType?: 'marketplace' | 'research';
}

export function ListingForm(props: ListingFormProps) {
  // Forward to improved editor
  return <ImprovedListingEditor {...props} />;
}
