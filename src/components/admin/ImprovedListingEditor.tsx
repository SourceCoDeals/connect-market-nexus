import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminListing } from "@/types/admin";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { parseCurrency, formatNumber } from "@/lib/currency-utils";
import { Loader2, Save, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

// Import section components
import { EditorBasicInfoSection } from "./editor-sections/EditorBasicInfoSection";
import { EditorDescriptionSection } from "./editor-sections/EditorDescriptionSection";
import { EditorFinancialSection } from "./editor-sections/EditorFinancialSection";
import { EditorVisualsSection } from "./editor-sections/EditorVisualsSection";
import { EditorInternalSection } from "./editor-sections/EditorInternalSection";
import { EditorLivePreview } from "./editor-sections/EditorLivePreview";

// Form schema
const listingFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  categories: z.array(z.string()).min(1, "Please select at least one category"),
  location: z.string().min(2, "Location is required"),
  revenue: z.string()
    .transform((val) => parseCurrency(val))
    .refine((val) => val >= 0, "Revenue cannot be negative"),
  ebitda: z.string()
    .transform((val) => parseCurrency(val))
    .refine((val) => val >= 0, "EBITDA cannot be negative"),
  full_time_employees: z.number().int().min(0).optional(),
  part_time_employees: z.number().int().min(0).optional(),
  description: z.string().min(20, "Description must be at least 20 characters"),
  description_html: z.string().optional(),
  description_json: z.any().optional(),
  owner_notes: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  status_tag: z.string().nullable().optional(),
  
  // Admin-only internal fields
  internal_company_name: z.string().optional(),
  internal_primary_owner: z.string().optional(),
  internal_salesforce_link: z.string().optional(),
  internal_deal_memo_link: z.string().optional(),
  internal_contact_info: z.string().optional(),
  internal_notes: z.string().optional(),
  
  // Buyer visibility control
  visible_to_buyer_types: z.array(z.enum([
    'privateEquity',
    'corporate', 
    'familyOffice',
    'searchFund',
    'individual',
    'independentSponsor',
    'advisor',
    'businessOwner'
  ])).nullable().optional(),
});

type ListingFormInput = {
  title: string;
  categories: string[];
  location: string;
  revenue: string;
  ebitda: string;
  full_time_employees?: number;
  part_time_employees?: number;
  description: string;
  description_html?: string;
  description_json?: any;
  owner_notes?: string;
  status: "active" | "inactive";
  status_tag?: string | null;
  visible_to_buyer_types?: string[] | null;
  internal_company_name?: string;
  internal_primary_owner?: string;
  internal_salesforce_link?: string;
  internal_deal_memo_link?: string;
  internal_contact_info?: string;
  internal_notes?: string;
};

type ListingFormValues = z.infer<typeof listingFormSchema>;

interface ImprovedListingEditorProps {
  onSubmit: (data: ListingFormValues & { description_html?: string; description_json?: any }, image?: File | null) => Promise<void>;
  listing?: AdminListing;
  isLoading?: boolean;
}

const convertListingToFormInput = (listing?: AdminListing): ListingFormInput => {
  return {
    title: listing?.title || "",
    categories: listing?.categories || (listing?.category ? [listing.category] : []),
    location: listing?.location || "",
    revenue: listing?.revenue ? formatNumber(Number(listing.revenue)) : "",
    ebitda: listing?.ebitda ? formatNumber(Number(listing.ebitda)) : "",
    full_time_employees: listing?.full_time_employees || undefined,
    part_time_employees: listing?.part_time_employees || undefined,
    description: listing?.description || "",
    description_html: listing?.description_html || "",
    description_json: listing?.description_json || null,
    owner_notes: listing?.owner_notes || "",
    status: listing?.status || "active",
    status_tag: listing?.status_tag ?? null,
    visible_to_buyer_types: listing?.visible_to_buyer_types || null,
    internal_company_name: listing?.internal_company_name || "",
    internal_primary_owner: listing?.internal_primary_owner || "",
    internal_salesforce_link: listing?.internal_salesforce_link || "",
    internal_deal_memo_link: listing?.internal_deal_memo_link || "",
    internal_contact_info: listing?.internal_contact_info || "",
    internal_notes: listing?.internal_notes || "",
  };
};

export function ImprovedListingEditor({
  onSubmit,
  listing,
  isLoading = false,
}: ImprovedListingEditorProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(listing?.image_url || null);
  const [isImageChanged, setIsImageChanged] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const form = useForm<ListingFormInput>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: convertListingToFormInput(listing),
  });

  const handleImageSelect = (file: File | null) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setImageError("Image file size must be less than 5MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        setImageError("Please select a valid image file");
        return;
      }
      
      setImageError(null);
      setSelectedImage(file);
      setIsImageChanged(true);
      
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setIsImageChanged(true);
    setImageError(null);
  };

  const handleSubmit = async (formData: ListingFormInput) => {
    try {
      if (imageError) {
        toast({
          variant: "destructive",
          title: "Image Error",
          description: imageError,
        });
        return;
      }
      
      const transformedData: ListingFormValues & { description_html?: string; description_json?: any } = {
        title: formData.title,
        categories: formData.categories,
        location: formData.location,
        revenue: parseCurrency(formData.revenue),
        ebitda: parseCurrency(formData.ebitda),
        full_time_employees: formData.full_time_employees,
        part_time_employees: formData.part_time_employees,
        description: formData.description,
        description_html: formData.description_html,
        description_json: formData.description_json,
        owner_notes: formData.owner_notes,
        status: formData.status,
        status_tag: formData.status_tag && formData.status_tag !== "none" ? formData.status_tag : null,
        internal_company_name: formData.internal_company_name || null,
        internal_primary_owner: formData.internal_primary_owner || null,
        internal_salesforce_link: formData.internal_salesforce_link || null,
        internal_deal_memo_link: formData.internal_deal_memo_link || null,
        internal_contact_info: formData.internal_contact_info || null,
        internal_notes: formData.internal_notes || null,
      };
      
      await onSubmit(transformedData, isImageChanged ? selectedImage : undefined);
      
      if (!listing) {
        form.reset();
        setSelectedImage(null);
        setImagePreview(null);
        setIsImageChanged(false);
      }
    } catch (error: any) {
      console.error("Error submitting listing:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save listing",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-border bg-background sticky top-0 z-10">
        <div>
          <h2 className="text-2xl font-light tracking-tight text-foreground">
            {listing ? "Edit Listing" : "Create New Listing"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {listing ? "Update listing information and details" : "Add a new business to the marketplace"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
          <Button
            onClick={form.handleSubmit(handleSubmit)}
            disabled={isLoading || !!imageError}
            className="gap-2 bg-sourceco-accent hover:bg-sourceco-accent/90 text-sourceco-accent-foreground"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {listing ? "Update Listing" : "Create Listing"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Editor Panel */}
        <div className={cn(
          "flex-1 overflow-y-auto transition-all duration-300",
          showPreview ? "lg:mr-[460px]" : "mr-0"
        )}>
          <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
                <EditorBasicInfoSection form={form} />
                <EditorFinancialSection form={form} />
                <EditorDescriptionSection form={form} />
                <EditorVisualsSection
                  imagePreview={imagePreview}
                  imageError={imageError}
                  onImageSelect={handleImageSelect}
                  onRemoveImage={handleRemoveImage}
                />
                <EditorInternalSection form={form} dealIdentifier={listing?.deal_identifier} />
              </form>
            </Form>
          </div>
        </div>

        {/* Live Preview Panel */}
        {showPreview && (
          <div className="hidden lg:block fixed top-16 right-0 w-[460px] h-[calc(100vh-4rem)] bg-muted/30 border-l border-border overflow-y-auto z-40">
            <EditorLivePreview
              formValues={form.watch()}
              imagePreview={imagePreview}
            />
          </div>
        )}
      </div>
    </div>
  );
}
