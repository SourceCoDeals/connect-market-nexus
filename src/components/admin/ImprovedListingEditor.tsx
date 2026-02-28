import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod/v3";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminListing } from "@/types/admin";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { parseCurrency } from "@/lib/currency-utils";
import { Loader2, Save, Target, Sparkles, ExternalLink } from "lucide-react";
import { useGenerateListingContent } from "@/hooks/admin/listings/use-generate-listing-content";

// Import section components
import { EditorTopBar } from "./editor-sections/EditorTopBar";
import { EditorFinancialCard } from "./editor-sections/EditorFinancialCard";
import { EditorDescriptionSection } from "./editor-sections/EditorDescriptionSection";
import { EditorHeroDescriptionSection } from "./editor-sections/EditorHeroDescriptionSection";
import { EditorVisualsSection } from "./editor-sections/EditorVisualsSection";
import { EditorInternalCard } from "./editor-sections/EditorInternalCard";
import { EditorLandingPageContentSection } from "./editor-sections/EditorLandingPageContentSection";
import { EditorLivePreview } from "./editor-sections/EditorLivePreview";

// Form schema - location accepts array from select component and transforms to string
const listingFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  categories: z.array(z.string()).min(1, "Please select at least one category"),
  acquisition_type: z.enum(['add_on', 'platform']).nullable().optional(),
  location: z.array(z.string()).min(1, "Location is required").transform((val) => val[0] || ''),
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
  hero_description: z.string().max(500, "Hero description must be 500 characters or less").nullable().optional(),
  owner_notes: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  status_tag: z.string().nullable().optional(),
  
  // Admin-only internal fields
  internal_company_name: z.string().nullable().optional(),
  primary_owner_id: z.string().uuid().nullable().optional(),
  presented_by_admin_id: z.string().uuid().nullable().optional(),
  internal_salesforce_link: z.string().nullable().optional(),
  internal_deal_memo_link: z.string().nullable().optional(),
  internal_contact_info: z.string().nullable().optional(),
  internal_notes: z.string().nullable().optional(),
  
  // Metrics fields
  custom_metric_label: z.string().nullable().optional(),
  custom_metric_value: z.string().nullable().optional(),
  custom_metric_subtitle: z.string().nullable().optional(),
  metric_3_type: z.enum(['employees', 'custom']).default('employees'),
  metric_3_custom_label: z.string().nullable().optional(),
  metric_3_custom_value: z.string().nullable().optional(),
  metric_3_custom_subtitle: z.string().nullable().optional(),
  metric_4_type: z.enum(['ebitda_margin', 'custom']).default('ebitda_margin'),
  metric_4_custom_label: z.string().nullable().optional(),
  metric_4_custom_value: z.string().nullable().optional(),
  metric_4_custom_subtitle: z.string().nullable().optional(),
  revenue_metric_subtitle: z.string().nullable().optional(),
  ebitda_metric_subtitle: z.string().nullable().optional(),
  
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

  // Landing page content fields
  investment_thesis: z.string().nullable().optional(),
  custom_sections: z.any().nullable().optional(),
  services: z.array(z.string()).nullable().optional(),
  growth_drivers: z.any().nullable().optional(),
  competitive_position: z.string().nullable().optional(),
  ownership_structure: z.string().nullable().optional(),
  seller_motivation: z.string().nullable().optional(),
  business_model: z.string().nullable().optional(),
  customer_geography: z.string().nullable().optional(),
  customer_types: z.string().nullable().optional(),
  revenue_model: z.string().nullable().optional(),
  end_market_description: z.string().nullable().optional(),
});

type ListingFormInput = {
  title: string;
  categories: string[];
  acquisition_type?: 'add_on' | 'platform' | string | null;
  location: string[]; // Array for form input, transformed to string by Zod
  revenue: string;
  ebitda: string;
  full_time_employees?: number;
  part_time_employees?: number;
  description: string;
  description_html?: string;
  description_json?: any;
  hero_description?: string | null;
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
  // Landing page content
  investment_thesis?: string | null;
  custom_sections?: any;
  services?: string[] | null;
  growth_drivers?: any;
  competitive_position?: string | null;
  ownership_structure?: string | null;
  seller_motivation?: string | null;
  business_model?: string | null;
  customer_geography?: string | null;
  customer_types?: string | null;
  revenue_model?: string | null;
  end_market_description?: string | null;
};

type ListingFormValues = z.infer<typeof listingFormSchema>;

interface ImprovedListingEditorProps {
  onSubmit: (data: ListingFormValues & { description_html?: string; description_json?: any }, image?: File | null) => Promise<void>;
  listing?: AdminListing;
  isLoading?: boolean;
  targetType?: 'marketplace' | 'research';
}

const convertListingToFormInput = (listing?: AdminListing): ListingFormInput => {
  return {
    title: listing?.title || "",
    categories: listing?.categories || (listing?.category ? [listing.category] : []),
    acquisition_type: listing?.acquisition_type || 'add_on',
    location: listing?.location ? [listing.location] : [], // Convert string to array for select component
    revenue: listing?.revenue ? listing.revenue.toString() : "",
    ebitda: listing?.ebitda ? listing.ebitda.toString() : "",
    full_time_employees: listing?.full_time_employees || 0,
    part_time_employees: listing?.part_time_employees || 0,
    description: listing?.description || "",
    description_html: listing?.description_html,
    description_json: listing?.description_json,
    hero_description: listing?.hero_description || null,
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
    // Landing page content
    investment_thesis: (listing as any)?.investment_thesis || null,
    custom_sections: (listing as any)?.custom_sections || null,
    services: (listing as any)?.services || null,
    growth_drivers: (listing as any)?.growth_drivers || null,
    competitive_position: (listing as any)?.competitive_position || null,
    ownership_structure: listing?.ownership_structure || null,
    seller_motivation: listing?.seller_motivation || null,
    business_model: (listing as any)?.business_model || null,
    customer_geography: (listing as any)?.customer_geography || null,
    customer_types: (listing as any)?.customer_types || null,
    revenue_model: (listing as any)?.revenue_model || null,
    end_market_description: (listing as any)?.end_market_description || null,
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

  // GAP 5: AI content generation
  const { generateContent, isGenerating, generatingField } = useGenerateListingContent();
  const sourceDealId = listing?.source_deal_id || listing?.id;

  const handleAiGenerate = async (field: string) => {
    if (!sourceDealId) {
      toast({ variant: 'destructive', title: 'No deal linked', description: 'This listing must be linked to a deal to generate AI content.' });
      return;
    }
    const content = await generateContent(sourceDealId, field);
    if (!content) return;

    // Apply generated content to the form
    if (field === 'description' && content.description) {
      form.setValue('description', content.description);
      form.setValue('description_html', `<p>${content.description.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`);
    } else if (field === 'hero_description' && content.hero_description) {
      form.setValue('hero_description', content.hero_description);
    } else if (field === 'title' && content.title_options?.length) {
      form.setValue('title', content.title_options[0]);
      toast({ title: 'Title options', description: `Generated ${content.title_options.length} options. Using the first one.` });
    }
  };

  const handleGenerateAll = async () => {
    if (!sourceDealId) {
      toast({ variant: 'destructive', title: 'No deal linked', description: 'This listing must be linked to a deal to generate AI content.' });
      return;
    }
    const content = await generateContent(sourceDealId);
    if (!content) return;

    // Apply all generated content
    if (content.title_options?.length) form.setValue('title', content.title_options[0]);
    if (content.hero_description) form.setValue('hero_description', content.hero_description);
    if (content.description) {
      form.setValue('description', content.description);
      form.setValue('description_html', `<p>${content.description.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`);
    }
    // Landing page content fields
    if (content.investment_thesis) form.setValue('investment_thesis', content.investment_thesis);
    if (content.custom_sections) form.setValue('custom_sections', content.custom_sections);
    if (content.services) form.setValue('services', content.services);
    if (content.growth_drivers) form.setValue('growth_drivers', content.growth_drivers);
    if (content.competitive_position) form.setValue('competitive_position', content.competitive_position);
    if (content.ownership_structure) form.setValue('ownership_structure', content.ownership_structure);
    if (content.seller_motivation) form.setValue('seller_motivation', content.seller_motivation);
    if (content.business_model) form.setValue('business_model', content.business_model);
    if (content.customer_geography) form.setValue('customer_geography', content.customer_geography);
    if (content.customer_types) form.setValue('customer_types', content.customer_types);
    if (content.revenue_model) form.setValue('revenue_model', content.revenue_model);
    if (content.end_market_description) form.setValue('end_market_description', content.end_market_description);
  };

  const form = useForm<ListingFormInput, unknown, ListingFormValues>({
     
    resolver: zodResolver(listingFormSchema as unknown as Parameters<typeof zodResolver>[0]),
    defaultValues: convertListingToFormInput(listing),
  });

  // Cast for child components that accept UseFormReturn<any>
  const formForSections = form as unknown as import('react-hook-form').UseFormReturn<Record<string, unknown>>;

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

  // Manual submit handler that validates first and shows errors
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const isValid = await form.trigger();
      
      if (!isValid) {
        const errors = form.formState.errors;
        const errorFields = Object.keys(errors).map(key => {
          const error = errors[key as keyof typeof errors];
          return `${key}: ${(error as { message?: string })?.message || 'Invalid'}`;
        }).join(', ');
        
        toast({
          variant: "destructive",
          title: "Please fix the following errors",
          description: errorFields || "Form validation failed",
        });
        return;
      }

      // Get form values and call the submit handler
      const formData = form.getValues();
      
      // Manual transformation since we're bypassing zodResolver's transform
      const transformedLocation = Array.isArray(formData.location) 
        ? formData.location[0] || '' 
        : formData.location || '';
      
      await handleSubmit({
        ...formData,
        location: transformedLocation,
      } as unknown as ListingFormValues);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please check all required fields are filled correctly.",
      });
    }
  };

  const handleSubmit = async (formData: ListingFormValues) => {
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
        ...formData,
        acquisition_type: (formData.acquisition_type === 'add_on' || formData.acquisition_type === 'platform') ? formData.acquisition_type : null,
        part_time_employees: formData.part_time_employees,
        description: formData.description,
        description_html: formData.description_html,
        description_json: formData.description_json,
        hero_description: formData.hero_description?.trim() || null,
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
        // Landing page content
        investment_thesis: formData.investment_thesis || null,
        custom_sections: formData.custom_sections || null,
        services: formData.services || null,
        growth_drivers: formData.growth_drivers || null,
        competitive_position: formData.competitive_position || null,
        ownership_structure: formData.ownership_structure || null,
        seller_motivation: formData.seller_motivation || null,
        business_model: formData.business_model || null,
        customer_geography: formData.customer_geography || null,
        customer_types: formData.customer_types || null,
        revenue_model: formData.revenue_model || null,
        end_market_description: formData.end_market_description || null,
      };

      await onSubmit(transformedData, isImageChanged ? selectedImage : undefined);
      
      if (!listing) {
        form.reset();
        setSelectedImage(null);
        setImagePreview(null);
        setIsImageChanged(false);
      }
    } catch (error: any) {
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
        <form onSubmit={handleFormSubmit}>
          {/* Target type banner */}
          {!listing && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-muted bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground">
              <Target className="h-4 w-4 shrink-0" />
              This listing will be created as a draft. Use the Publish button on the card to make it live on the marketplace.
            </div>
          )}
          
          {/* GAP 5+8: AI Generate All + Landing Page Preview buttons */}
          {sourceDealId && (
            <div className="mb-6 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateAll}
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating && generatingField === 'all' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGenerating && generatingField === 'all' ? 'Generating All...' : 'Generate All with AI'}
              </Button>
              {listing?.id && (
                <a
                  href={`/deals/${listing.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted/50 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Preview Landing Page
                </a>
              )}
            </div>
          )}

          {/* TOP BAR - Critical fields */}
          <EditorTopBar form={formForSections} />

          {/* MAIN CONTENT - Card grid */}
          <div className="grid grid-cols-[1fr_540px] gap-8 mb-6">
              {/* Left: Financial */}
              <EditorFinancialCard form={formForSections} />

              {/* Right: Internal */}
              <EditorInternalCard form={formForSections} dealIdentifier={listing?.deal_identifier} />
            </div>

            {/* FULL WIDTH - Description */}
            <div className="mb-6">
              <EditorDescriptionSection form={formForSections} onAiGenerate={sourceDealId ? handleAiGenerate : undefined} isGenerating={isGenerating} generatingField={generatingField} />
            </div>

            {/* FULL WIDTH - Hero Description */}
            <div className="mb-6">
              <EditorHeroDescriptionSection form={formForSections} onAiGenerate={sourceDealId ? handleAiGenerate : undefined} isGenerating={isGenerating} generatingField={generatingField} />
            </div>
            
            {/* FULL WIDTH - Landing Page Content */}
            <div className="mb-6">
              <EditorLandingPageContentSection form={formForSections} />
            </div>

            {/* Two-column: Image + Live Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <EditorVisualsSection
                imagePreview={imagePreview}
                imageError={imageError}
                onImageSelect={handleImageSelect}
                onRemoveImage={handleRemoveImage}
              />
              <EditorLivePreview formValues={form.watch()} imagePreview={imagePreview} />
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
