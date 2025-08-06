import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminListing } from "@/types/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { MultiSelect } from "@/components/ui/multi-select";
import { ImageUpload } from "@/components/ui/image-upload";
import { RichTextEditorEnhanced } from "@/components/ui/rich-text-editor-enhanced";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Building2, Users, TrendingUp, Shield, Plus, X } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseCurrency, formatNumber } from "@/lib/currency-utils";
import { useAdmin } from "@/hooks/use-admin";

// Enhanced schema with investor-focused fields
const enhancedListingFormSchema = z.object({
  // Basic information
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  categories: z.array(z.string()).min(1, "Please select at least one category"),
  location: z.string().min(2, "Location is required"),
  revenue: z.string()
    .transform((val) => parseCurrency(val))
    .refine((val) => val >= 0, "Revenue cannot be negative"),
  ebitda: z.string()
    .transform((val) => parseCurrency(val))
    .refine((val) => val >= 0, "EBITDA cannot be negative"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  description_html: z.string().optional(),
  description_json: z.any().optional(),
  owner_notes: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  
  // Investment thesis
  investment_thesis: z.string().optional(),
  
  // Ownership & transaction
  ownership_structure: z.enum(["individual", "family", "corporate", "private_equity"]).optional(),
  seller_motivation: z.enum(["retirement", "succession", "growth_capital", "liquidity_event"]).optional(),
  management_depth: z.enum(["owner_operated", "management_team", "succession_ready"]).optional(),
  seller_involvement_preference: z.string().optional(),
  timeline_preference: z.string().optional(),
  
  // Financial details
  customer_concentration: z.string().optional().transform((val) => val ? parseFloat(val) : undefined),
  revenue_model_recurring: z.string().optional().transform((val) => val ? parseFloat(val) : undefined),
  revenue_model_project: z.string().optional().transform((val) => val ? parseFloat(val) : undefined),
  
  // Growth & risk
  growth_drivers: z.string().optional(),
  key_risks: z.string().optional(),
  
  // Market position
  market_rank: z.string().optional(),
  geographic_coverage: z.string().optional(),
  
  // Custom sections
  custom_sections: z.array(z.object({
    title: z.string(),
    description: z.string()
  })).optional(),
});

type EnhancedListingFormInput = {
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
  investment_thesis?: string;
  ownership_structure?: "individual" | "family" | "corporate" | "private_equity";
  seller_motivation?: "retirement" | "succession" | "growth_capital" | "liquidity_event";
  management_depth?: "owner_operated" | "management_team" | "succession_ready";
  seller_involvement_preference?: string;
  timeline_preference?: string;
  customer_concentration?: string;
  revenue_model_recurring?: string;
  revenue_model_project?: string;
  growth_drivers?: string;
  key_risks?: string;
  market_rank?: string;
  geographic_coverage?: string;
  custom_sections?: { title: string; description: string; }[];
};

type EnhancedListingFormValues = z.infer<typeof enhancedListingFormSchema>;

interface EnhancedListingFormProps {
  onSubmit: (data: any, image?: File | null) => Promise<void>;
  listing?: AdminListing;
  isLoading?: boolean;
}

const convertListingToFormInput = (listing?: AdminListing): EnhancedListingFormInput => {
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
    investment_thesis: listing?.investment_thesis || "",
    ownership_structure: listing?.ownership_structure as any,
    seller_motivation: listing?.seller_motivation as any,
    management_depth: listing?.management_depth as any,
    seller_involvement_preference: listing?.seller_involvement_preference || "",
    timeline_preference: listing?.timeline_preference || "",
    customer_concentration: listing?.customer_concentration?.toString() || "",
    revenue_model_recurring: listing?.revenue_model_breakdown?.recurring?.toString() || "",
    revenue_model_project: listing?.revenue_model_breakdown?.project?.toString() || "",
    growth_drivers: listing?.growth_drivers?.join('\n') || "",
    key_risks: listing?.key_risks?.join('\n') || "",
    market_rank: listing?.market_position?.rank || "",
    geographic_coverage: listing?.market_position?.coverage || "",
    custom_sections: (listing as any)?.custom_sections || [],
  };
};

export function EnhancedListingForm({
  onSubmit,
  listing,
  isLoading = false,
}: EnhancedListingFormProps) {
  const { useCategories } = useAdmin();
  const { data: categories = [] } = useCategories();
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    listing?.image_url || null
  );
  const [isImageChanged, setIsImageChanged] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const form = useForm<EnhancedListingFormInput>({
    resolver: zodResolver(enhancedListingFormSchema),
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

  const handleSubmit = async (formData: EnhancedListingFormInput) => {
    try {
      if (imageError) {
        toast({
          variant: "destructive",
          title: "Image Error",
          description: imageError,
        });
        return;
      }
      
      // Transform the form data
      const transformedData = {
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
        investment_thesis: formData.investment_thesis,
        ownership_structure: formData.ownership_structure,
        seller_motivation: formData.seller_motivation,
        management_depth: formData.management_depth,
        seller_involvement_preference: formData.seller_involvement_preference,
        timeline_preference: formData.timeline_preference,
        customer_concentration: formData.customer_concentration ? parseFloat(formData.customer_concentration) : undefined,
        revenue_model_breakdown: {
          recurring: formData.revenue_model_recurring || 0,
          project: formData.revenue_model_project || 0,
        },
        growth_drivers: formData.growth_drivers ? formData.growth_drivers.split('\n').filter(d => d.trim()) : [],
        key_risks: formData.key_risks ? formData.key_risks.split('\n').filter(r => r.trim()) : [],
        market_position: {
          rank: formData.market_rank || "",
          coverage: formData.geographic_coverage || "",
        },
        custom_sections: formData.custom_sections || [],
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

  const categoryOptions = categories.map(category => ({
    value: category.name,
    label: category.name,
  }));

  return (
    <Card className="max-w-5xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          {listing ? "Edit Listing" : "Create New Listing"}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="ownership">Ownership & Transaction</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="strategy">Strategy & Risk</TabsTrigger>
                <TabsTrigger value="custom">Custom Sections</TabsTrigger>
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Title</FormLabel>
                          <FormControl>
                            <Input placeholder="E.g., Profitable SaaS Business" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="categories"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Categories</FormLabel>
                            <FormControl>
                              <MultiSelect
                                options={categoryOptions}
                                selected={field.value}
                                onSelectedChange={field.onChange}
                                placeholder="Select categories..."
                                maxSelected={2}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input placeholder="E.g., New York, NY" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="revenue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Annual Revenue</FormLabel>
                            <FormControl>
                              <CurrencyInput
                                placeholder="Enter annual revenue"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="ebitda"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Annual EBITDA</FormLabel>
                            <FormControl>
                              <CurrencyInput
                                placeholder="Enter annual EBITDA"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-3">
                      <FormLabel>Listing Image</FormLabel>
                      <ImageUpload
                        onImageSelect={handleImageSelect}
                        currentImageUrl={imagePreview}
                        onRemoveImage={handleRemoveImage}
                        error={imageError}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Ownership & Transaction Tab */}
              <TabsContent value="ownership" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Ownership & Transaction Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="ownership_structure"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ownership Structure</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select ownership type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="individual">Individual</SelectItem>
                                <SelectItem value="family">Family Business</SelectItem>
                                <SelectItem value="corporate">Corporate</SelectItem>
                                <SelectItem value="private_equity">Private Equity</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="seller_motivation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Seller Motivation</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select motivation" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="retirement">Retirement</SelectItem>
                                <SelectItem value="succession">Succession Planning</SelectItem>
                                <SelectItem value="growth_capital">Growth Capital</SelectItem>
                                <SelectItem value="liquidity_event">Liquidity Event</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="management_depth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Management Structure</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select management depth" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="owner_operated">Owner Operated</SelectItem>
                                <SelectItem value="management_team">Management Team</SelectItem>
                                <SelectItem value="succession_ready">Succession Ready</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="timeline_preference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timeline Preference</FormLabel>
                            <FormControl>
                              <Input placeholder="E.g., 6-12 months" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="seller_involvement_preference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Post-Sale Involvement Preference</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe seller's preferred involvement after sale..."
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Financial Details Tab */}
              <TabsContent value="financial" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Financial Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="customer_concentration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Concentration (%)</FormLabel>
                          <FormDescription>
                            Percentage of revenue from top 5 customers
                          </FormDescription>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              max="100"
                              placeholder="E.g., 25" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="revenue_model_recurring"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Recurring Revenue (%)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                max="100"
                                placeholder="E.g., 70" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="revenue_model_project"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project-Based Revenue (%)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                max="100"
                                placeholder="E.g., 30" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="market_rank"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Market Position</FormLabel>
                            <FormControl>
                              <Input placeholder="E.g., Regional leader" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="geographic_coverage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Geographic Coverage</FormLabel>
                            <FormControl>
                              <Input placeholder="E.g., Western US" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Strategy & Risk Tab */}
              <TabsContent value="strategy" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Investment Thesis & Risk Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="investment_thesis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Investment Thesis</FormLabel>
                          <FormDescription>
                            Dedicated investment thesis separate from business overview
                          </FormDescription>
                          <FormControl>
                            <Textarea 
                              placeholder="Articulate the core investment opportunity..."
                              className="min-h-[120px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="growth_drivers"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Growth Drivers</FormLabel>
                          <FormDescription>
                            One per line - specific growth opportunities and catalysts
                          </FormDescription>
                          <FormControl>
                            <Textarea 
                              placeholder="Market expansion opportunities&#10;Infrastructure investment trends&#10;Operational improvements"
                              className="min-h-[100px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="key_risks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key Risk Factors</FormLabel>
                          <FormDescription>
                            One per line - material business risks that investors should consider
                          </FormDescription>
                          <FormControl>
                            <Textarea 
                              placeholder="Customer concentration risk&#10;Seasonal revenue fluctuations&#10;Key person dependency"
                              className="min-h-[100px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <div className="space-y-4">
                      <FormLabel className="text-base font-semibold">Business Description</FormLabel>
                      
                      <FormField
                        control={form.control}
                        name="description_html"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <RichTextEditorEnhanced
                                content={field.value || form.getValues('description') || ''}
                                onChange={(html, json) => {
                                  field.onChange(html);
                                  form.setValue('description_json', json);
                                  const tempDiv = document.createElement('div');
                                  tempDiv.innerHTML = html;
                                  const plainText = tempDiv.textContent || tempDiv.innerText || '';
                                  form.setValue('description', plainText);
                                }}
                                placeholder="Create a compelling business description..."
                                className="min-h-[400px]"
                                characterLimit={20000}
                                autoSave={true}
                                showWordCount={true}
                                showPreview={true}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="owner_notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Notes (Internal)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any additional notes visible only to admins..."
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Custom Sections Tab */}
              <TabsContent value="custom" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Custom Sections
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="custom_sections"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Listing Sections</FormLabel>
                          <FormDescription>
                            Add custom sections that will appear on the listing page in premium style
                          </FormDescription>
                          <div className="space-y-4">
                            {(field.value || []).map((section: any, index: number) => (
                              <Card key={index} className="p-4">
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-medium">Section {index + 1}</h4>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const updatedSections = (field.value || []).filter((_: any, i: number) => i !== index);
                                        field.onChange(updatedSections);
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-sm font-medium">Section Title</label>
                                      <Input
                                        placeholder="e.g., Financial Performance"
                                        value={section.title}
                                        onChange={(e) => {
                                          const updatedSections = [...(field.value || [])];
                                          updatedSections[index] = { ...section, title: e.target.value };
                                          field.onChange(updatedSections);
                                        }}
                                      />
                                    </div>
                                    <div className="md:col-span-1">
                                      <label className="text-sm font-medium">Description</label>
                                      <Textarea
                                        placeholder="Detailed information for this section..."
                                        value={section.description}
                                        onChange={(e) => {
                                          const updatedSections = [...(field.value || [])];
                                          updatedSections[index] = { ...section, description: e.target.value };
                                          field.onChange(updatedSections);
                                        }}
                                        className="min-h-[80px]"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const currentSections = field.value || [];
                                field.onChange([...currentSections, { title: "", description: "" }]);
                              }}
                              className="w-full"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Custom Section
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end pt-6">
              <Button 
                type="submit" 
                disabled={isLoading || !!imageError}
                className="w-32"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {listing ? "Update" : "Create"} Listing
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}