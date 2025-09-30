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
import { LocationSelect } from "@/components/ui/location-select";
import { STANDARDIZED_CATEGORIES } from "@/lib/financial-parser";
import { Loader2 } from "lucide-react";
import { InternalCompanyInfoSection } from "./InternalCompanyInfoSection";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { ImprovedListingEditor } from "./ImprovedListingEditor";

// Form schema with categories array instead of single category
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
});

// Form-specific type that matches the Zod schema (before transformation)
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
  status_tag?: string;
  
  // Admin-only internal fields
  internal_company_name?: string;
  internal_primary_owner?: string;
  internal_salesforce_link?: string;
  internal_deal_memo_link?: string;
  internal_contact_info?: string;
  internal_notes?: string;
};

// Type after Zod transformation
type ListingFormValues = z.infer<typeof listingFormSchema>;

interface ListingFormProps {
  onSubmit: (data: ListingFormValues & { description_html?: string; description_json?: any }, image?: File | null) => Promise<void>;
  listing?: AdminListing;
  isLoading?: boolean;
}

// Helper function to convert AdminListing to form input format
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
    
    // Admin-only internal fields
    internal_company_name: listing?.internal_company_name || "",
    internal_primary_owner: listing?.internal_primary_owner || "",
    internal_salesforce_link: listing?.internal_salesforce_link || "",
    internal_deal_memo_link: listing?.internal_deal_memo_link || "",
    internal_contact_info: listing?.internal_contact_info || "",
    internal_notes: listing?.internal_notes || "",
  };
};

export function ListingForm(props: ListingFormProps) {
  // Forward to improved editor
  return <ImprovedListingEditor {...props} />;
}
