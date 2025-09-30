import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AdminListing } from "@/types/admin";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Save, Eye, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { parseCurrency, formatNumber } from "@/lib/currency-utils";
import { BasicInfoStep } from "./steps/BasicInfoStep";
import { DescriptionStep } from "./steps/DescriptionStep";
import { InvestmentDetailsStep } from "./steps/InvestmentDetailsStep";
import { FinancialMetricsStep } from "./steps/FinancialMetricsStep";
import { InternalInfoStep } from "./steps/InternalInfoStep";
import { WizardNavigation } from "./WizardNavigation";
import { LivePreviewPanel } from "./LivePreviewPanel";

const listingFormSchema = z.object({
  // Basic Info
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  categories: z.array(z.string()).min(1, "Please select at least one category"),
  location: z.string().min(2, "Location is required"),
  revenue: z.string().transform((val) => parseCurrency(val)),
  ebitda: z.string().transform((val) => parseCurrency(val)),
  status: z.enum(["active", "inactive"]).default("active"),
  status_tag: z.string().nullable().optional(),
  
  // Description
  description: z.string().min(20, "Description must be at least 20 characters"),
  description_html: z.string().optional(),
  description_json: z.any().optional(),
  
  // Investment Details (optional enhanced fields)
  owner_notes: z.string().optional(),
  
  // Internal fields
  internal_company_name: z.string().optional(),
  internal_primary_owner: z.string().optional(),
  internal_salesforce_link: z.string().optional(),
  internal_deal_memo_link: z.string().optional(),
  internal_contact_info: z.string().optional(),
  internal_notes: z.string().optional(),
});

type ListingFormInput = {
  title: string;
  categories: string[];
  location: string;
  revenue: string;
  ebitda: string;
  description: string;
  description_html?: string;
  description_json?: any;
  owner_notes?: string;
  status: "active" | "inactive";
  status_tag?: string | null;
  internal_company_name?: string;
  internal_primary_owner?: string;
  internal_salesforce_link?: string;
  internal_deal_memo_link?: string;
  internal_contact_info?: string;
  internal_notes?: string;
};

type ListingFormValues = z.infer<typeof listingFormSchema>;

interface WizardListingFormProps {
  onSubmit: (data: ListingFormValues & { description_html?: string; description_json?: any }, image?: File | null) => Promise<void>;
  listing?: AdminListing;
  isLoading?: boolean;
  onCancel?: () => void;
}

const STEPS = [
  { id: 1, name: "Basic Information", description: "Core business details" },
  { id: 2, name: "Business Description", description: "Professional content creation" },
  { id: 3, name: "Investment Details", description: "Deal-specific information" },
  { id: 4, name: "Financial Analytics", description: "Advanced metrics" },
  { id: 5, name: "Internal Information", description: "Admin-only fields" },
];

const convertListingToFormInput = (listing?: AdminListing): ListingFormInput => {
  return {
    title: listing?.title || "",
    categories: listing?.categories || (listing?.category ? [listing.category] : []),
    location: listing?.location || "",
    revenue: listing?.revenue ? formatNumber(Number(listing.revenue)) : "",
    ebitda: listing?.ebitda ? formatNumber(Number(listing.ebitda)) : "",
    description: listing?.description || "",
    description_html: listing?.description_html || "",
    description_json: listing?.description_json || null,
    owner_notes: listing?.owner_notes || "",
    status: listing?.status || "active",
    status_tag: listing?.status_tag ?? null,
    internal_company_name: listing?.internal_company_name || "",
    internal_primary_owner: listing?.internal_primary_owner || "",
    internal_salesforce_link: listing?.internal_salesforce_link || "",
    internal_deal_memo_link: listing?.internal_deal_memo_link || "",
    internal_contact_info: listing?.internal_contact_info || "",
    internal_notes: listing?.internal_notes || "",
  };
};

export function WizardListingForm({ onSubmit, listing, isLoading = false, onCancel }: WizardListingFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(listing?.image_url || null);
  const [isImageChanged, setIsImageChanged] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const form = useForm<ListingFormInput>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: convertListingToFormInput(listing),
    mode: "onChange",
  });

  const progress = (currentStep / STEPS.length) * 100;

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
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setIsImageChanged(true);
    setImageError(null);
  };

  const validateStep = async (step: number): Promise<boolean> => {
    const fieldsToValidate: Record<number, (keyof ListingFormInput)[]> = {
      1: ['title', 'categories', 'location', 'revenue', 'ebitda', 'status'],
      2: ['description'],
      3: ['owner_notes'],
      4: [],
      5: [],
    };

    const fields = fieldsToValidate[step];
    const result = await form.trigger(fields);
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = async (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
    } else if (step === currentStep + 1) {
      await handleNext();
    }
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
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      {/* Left Sidebar - Navigation */}
      <div className="w-64 flex-shrink-0">
        <Card className="sticky top-6">
          <CardContent className="p-4">
            <div className="mb-4">
              <div className="text-sm font-medium mb-2">Progress</div>
              <Progress value={progress} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                Step {currentStep} of {STEPS.length}
              </div>
            </div>
            
            <WizardNavigation
              steps={STEPS}
              currentStep={currentStep}
              onStepClick={handleStepClick}
            />
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Card>
              <CardContent className="p-6">
                {currentStep === 1 && (
                  <BasicInfoStep
                    control={form.control}
                    selectedImage={selectedImage}
                    imagePreview={imagePreview}
                    imageError={imageError}
                    onImageSelect={handleImageSelect}
                    onRemoveImage={handleRemoveImage}
                  />
                )}
                
                {currentStep === 2 && (
                  <DescriptionStep control={form.control} setValue={form.setValue} />
                )}
                
                {currentStep === 3 && (
                  <InvestmentDetailsStep control={form.control} />
                )}
                
                {currentStep === 4 && (
                  <FinancialMetricsStep control={form.control} />
                )}
                
                {currentStep === 5 && (
                  <InternalInfoStep control={form.control} dealIdentifier={listing?.deal_identifier} />
                )}
              </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t">
              <div>
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={isLoading}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                {onCancel && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                )}
                
                {currentStep < STEPS.length ? (
                  <Button type="button" onClick={handleNext} disabled={isLoading}>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={isLoading || !!imageError}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    {listing ? "Update Listing" : "Create Listing"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </div>

      {/* Right Panel - Live Preview */}
      <div className="w-80 flex-shrink-0">
        <LivePreviewPanel
          formData={form.watch()}
          imagePreview={imagePreview}
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview(!showPreview)}
        />
      </div>
    </div>
  );
}
