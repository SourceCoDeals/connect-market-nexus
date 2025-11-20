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
import { EditorTopBar } from "./editor-sections/EditorTopBar";
import { EditorFinancialCard } from "./editor-sections/EditorFinancialCard";
import { EditorDescriptionSection } from "./editor-sections/EditorDescriptionSection";
import { EditorVisualsSection } from "./editor-sections/EditorVisualsSection";
import { EditorInternalCard } from "./editor-sections/EditorInternalCard";
import { EDITOR_DESIGN } from "@/lib/editor-design-system";

// Form schema
const listingFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  categories: z.array(z.string()).min(1, "Please select at least one category"),
  acquisition_type: z.enum(['add_on', 'platform']).nullable().optional(),
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
  primary_owner_id: z.string().uuid().nullable().optional(),
  presented_by_admin_id: z.string().email().nullable().optional(),
  internal_salesforce_link: z.string().optional(),
  internal_deal_memo_link: z.string().optional(),
  internal_contact_info: z.string().optional(),
  internal_notes: z.string().optional(),
  
  // Metrics fields
  custom_metric_label: z.string().optional(),
  custom_metric_value: z.string().optional(),
  custom_metric_subtitle: z.string().optional(),
  metric_3_type: z.enum(['employees', 'custom']).default('employees'),
  metric_3_custom_label: z.string().optional(),
  metric_3_custom_value: z.string().optional(),
  metric_3_custom_subtitle: z.string().optional(),
  metric_4_type: z.enum(['ebitda_margin', 'custom']).default('ebitda_margin'),
  metric_4_custom_label: z.string().optional(),
  metric_4_custom_value: z.string().optional(),
  metric_4_custom_subtitle: z.string().optional(),
  revenue_metric_subtitle: z.string().optional(),
  ebitda_metric_subtitle: z.string().optional(),
  
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
  acquisition_type?: 'add_on' | 'platform' | string | null;
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
  custom_metric_label?: string;
  custom_metric_value?: string;
  custom_metric_subtitle?: string;
  metric_3_type?: 'employees' | 'custom';
  metric_3_custom_label?: string;
  metric_3_custom_value?: string;
  metric_3_custom_subtitle?: string;
  metric_4_type?: 'ebitda_margin' | 'custom';
  metric_4_custom_label?: string;
  metric_4_custom_value?: string;
  metric_4_custom_subtitle?: string;
  revenue_metric_subtitle?: string;
  ebitda_metric_subtitle?: string;
  presented_by_admin_id?: string | null;
  internal_company_name?: string;
  primary_owner_id?: string | null;
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
    acquisition_type: listing?.acquisition_type || 'add_on',
    location: listing?.location || "",
    revenue: listing?.revenue ? listing.revenue.toString() : "",
    ebitda: listing?.ebitda ? listing.ebitda.toString() : "",
    full_time_employees: listing?.full_time_employees || 0,
    part_time_employees: listing?.part_time_employees || 0,
    description: listing?.description || "",
    description_html: listing?.description_html,
    description_json: listing?.description_json,
    owner_notes: listing?.owner_notes,
    status: listing?.status || "active",
    status_tag: listing?.status_tag || null,
    visible_to_buyer_types: listing?.visible_to_buyer_types || null,
    custom_metric_label: listing?.custom_metric_label || "",
    custom_metric_value: listing?.custom_metric_value || "",
    custom_metric_subtitle: listing?.custom_metric_subtitle || "",
    metric_3_type: listing?.metric_3_type || 'employees',
    metric_3_custom_label: listing?.metric_3_custom_label || "",
    metric_3_custom_value: listing?.metric_3_custom_value || "",
    metric_3_custom_subtitle: listing?.metric_3_custom_subtitle || "",
    metric_4_type: (listing?.metric_4_type || 'ebitda_margin') as 'ebitda_margin' | 'custom',
    metric_4_custom_label: listing?.metric_4_custom_label || "",
    metric_4_custom_value: listing?.metric_4_custom_value || "",
    metric_4_custom_subtitle: listing?.metric_4_custom_subtitle || "",
    revenue_metric_subtitle: listing?.revenue_metric_subtitle || "",
    ebitda_metric_subtitle: listing?.ebitda_metric_subtitle || "",
    presented_by_admin_id: listing?.presented_by_admin_id || null,
    internal_company_name: listing?.internal_company_name || "",
    primary_owner_id: listing?.primary_owner_id || null,
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

  const form = useForm<ListingFormInput, any, ListingFormValues>({
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

  const handleSubmit = async (formData: ListingFormValues) => {
    try {
      console.log('[EDITOR] Raw form data from Zod:', formData);
      console.log('[EDITOR] Revenue type:', typeof formData.revenue, 'Value:', formData.revenue);
      console.log('[EDITOR] EBITDA type:', typeof formData.ebitda, 'Value:', formData.ebitda);
      
      if (imageError) {
        toast({
          variant: "destructive",
          title: "Image Error",
          description: imageError,
        });
        return;
      }
      
      const transformedData: ListingFormValues & { description_html?: string; description_json?: any } = {
        ...formData,
        acquisition_type: (formData.acquisition_type === 'add_on' || formData.acquisition_type === 'platform') ? formData.acquisition_type : null,
        part_time_employees: formData.part_time_employees,
        description: formData.description,
        description_html: formData.description_html,
        description_json: formData.description_json,
        owner_notes: formData.owner_notes,
        status: formData.status,
        status_tag: formData.status_tag && formData.status_tag !== "none" ? formData.status_tag : null,
        visible_to_buyer_types: (formData.visible_to_buyer_types || null) as ('privateEquity' | 'corporate' | 'familyOffice' | 'searchFund' | 'individual' | 'independentSponsor' | 'advisor' | 'businessOwner')[] | null,
        custom_metric_label: formData.custom_metric_label || null,
        custom_metric_value: formData.custom_metric_value || null,
        custom_metric_subtitle: formData.custom_metric_subtitle || null,
        metric_3_type: formData.metric_3_type || 'employees',
        metric_3_custom_label: formData.metric_3_custom_label || null,
        metric_3_custom_value: formData.metric_3_custom_value || null,
        metric_3_custom_subtitle: formData.metric_3_custom_subtitle || null,
        metric_4_type: formData.metric_4_type || 'ebitda_margin',
        metric_4_custom_label: formData.metric_4_custom_label || null,
        metric_4_custom_value: formData.metric_4_custom_value || null,
        metric_4_custom_subtitle: formData.metric_4_custom_subtitle || null,
        revenue_metric_subtitle: formData.revenue_metric_subtitle || null,
        ebitda_metric_subtitle: formData.ebitda_metric_subtitle || null,
        presented_by_admin_id: formData.presented_by_admin_id || null,
        internal_company_name: formData.internal_company_name || null,
        primary_owner_id: formData.primary_owner_id || null,
        internal_salesforce_link: formData.internal_salesforce_link || null,
        internal_deal_memo_link: formData.internal_deal_memo_link || null,
        internal_contact_info: formData.internal_contact_info || null,
        internal_notes: formData.internal_notes || null,
      };
      
      console.log('[EDITOR] Transformed data being sent:', transformedData);
      console.log('[EDITOR] Is image changed:', isImageChanged);
      console.log('[EDITOR] Selected image:', selectedImage);
      
      await onSubmit(transformedData, isImageChanged ? selectedImage : undefined);
      
      if (!listing) {
        form.reset();
        setSelectedImage(null);
        setImagePreview(null);
        setIsImageChanged(false);
      }
    } catch (error: any) {
      console.error('[EDITOR] Form submission error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save listing",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50/30">
    <div className="max-w-[1920px] mx-auto px-12 py-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          {/* TOP BAR - Critical fields */}
          <EditorTopBar form={form} />
          
          {/* MAIN CONTENT - Card grid */}
          <div className="grid grid-cols-[1fr_540px] gap-8 mb-6">
              {/* Left: Financial */}
              <EditorFinancialCard form={form} />
              
              {/* Right: Internal */}
              <EditorInternalCard form={form} dealIdentifier={listing?.deal_identifier} />
            </div>
            
            {/* FULL WIDTH - Description */}
            <div className="mb-6">
              <EditorDescriptionSection form={form} />
            </div>
            
            {/* FULL WIDTH - Image */}
            <div className="mb-6">
              <EditorVisualsSection
                imagePreview={imagePreview}
                imageError={imageError}
                onImageSelect={handleImageSelect}
                onRemoveImage={handleRemoveImage}
              />
            </div>
            
            {/* FOOTER - Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-border/30">
              <div className="text-sm text-muted-foreground">
                {listing ? `Last updated: ${new Date(listing.updated_at).toLocaleDateString()}` : 'Draft'}
              </div>
              <Button 
                type="submit" 
                disabled={isLoading || !!imageError}
                className="gap-2"
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
          </form>
        </Form>
      </div>
    </div>
  );
}
