
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface OwnerInquiryData {
  name: string;
  email: string;
  phone_number: string;
  company_name: string;
  business_website: string | null;
  estimated_revenue_range: string;
  sale_timeline: string;
  message: string | null;
}

export function useOwnerInquiry() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitInquiry = async (data: OwnerInquiryData): Promise<boolean> => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("inbound_leads")
        .insert({
          name: data.name,
          email: data.email,
          phone_number: data.phone_number,
          company_name: data.company_name,
          business_website: data.business_website,
          estimated_revenue_range: data.estimated_revenue_range,
          sale_timeline: data.sale_timeline,
          message: data.message,
          source: "owner_inquiry_form",
          lead_type: "owner",
          status: "new",
          role: "business_owner",
        });

      if (error) {
        console.error("Error submitting owner inquiry:", error);
        toast({
          variant: "destructive",
          title: "Submission failed",
          description: "There was an error submitting your inquiry. Please try again.",
        });
        return false;
      }

      toast({
        title: "Inquiry submitted",
        description: "We'll be in touch within 24-48 hours.",
      });
      return true;
    } catch (err) {
      console.error("Error submitting owner inquiry:", err);
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: "There was an error submitting your inquiry. Please try again.",
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    submitInquiry,
    isSubmitting,
  };
}
