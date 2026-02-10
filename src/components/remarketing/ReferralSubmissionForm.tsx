import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface ReferralSubmissionFormProps {
  shareToken: string;
  onSubmitted: () => void;
}

interface FormData {
  company_name: string;
  website: string;
  industry: string;
  revenue: string;
  ebitda: string;
  location: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string;
}

const defaultForm: FormData = {
  company_name: "",
  website: "",
  industry: "",
  revenue: "",
  ebitda: "",
  location: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  notes: "",
};

function parseFinancialValue(str: string): number | null {
  if (!str.trim()) return null;
  const cleaned = str.replace(/[$,\s]/g, "").toUpperCase();
  let multiplier = 1;
  let numStr = cleaned;
  if (cleaned.endsWith("M")) {
    multiplier = 1_000_000;
    numStr = cleaned.slice(0, -1);
  } else if (cleaned.endsWith("K")) {
    multiplier = 1_000;
    numStr = cleaned.slice(0, -1);
  }
  const parsed = parseFloat(numStr);
  if (isNaN(parsed)) return null;
  return parsed * multiplier;
}

export function ReferralSubmissionForm({
  shareToken,
  onSubmitted,
}: ReferralSubmissionFormProps) {
  const [form, setForm] = useState<FormData>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.company_name.trim()) {
      toast.error("Company name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "submit-referral-deal",
        {
          body: {
            shareToken,
            submission: {
              company_name: form.company_name.trim(),
              website: form.website.trim() || null,
              industry: form.industry.trim() || null,
              revenue: parseFinancialValue(form.revenue),
              ebitda: parseFinancialValue(form.ebitda),
              location: form.location.trim() || null,
              contact_name: form.contact_name.trim() || null,
              contact_email: form.contact_email.trim() || null,
              contact_phone: form.contact_phone.trim() || null,
              notes: form.notes.trim() || null,
            },
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Referral submitted successfully");
      setForm(defaultForm);
      onSubmitted();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit referral");
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (field: keyof FormData, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sub-company">Company Name *</Label>
        <Input
          id="sub-company"
          placeholder="The name of the business"
          value={form.company_name}
          onChange={(e) => update("company_name", e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sub-website">Website</Label>
          <Input
            id="sub-website"
            placeholder="https://example.com"
            value={form.website}
            onChange={(e) => update("website", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-industry">Industry</Label>
          <Input
            id="sub-industry"
            placeholder="e.g. HVAC, Plumbing, IT Services"
            value={form.industry}
            onChange={(e) => update("industry", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sub-revenue">Annual Revenue</Label>
          <Input
            id="sub-revenue"
            placeholder="e.g. $5M or 5000000"
            value={form.revenue}
            onChange={(e) => update("revenue", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-ebitda">EBITDA</Label>
          <Input
            id="sub-ebitda"
            placeholder="e.g. $1.2M or 1200000"
            value={form.ebitda}
            onChange={(e) => update("ebitda", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sub-location">Location</Label>
        <Input
          id="sub-location"
          placeholder="City, State or general area"
          value={form.location}
          onChange={(e) => update("location", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sub-contact-name">Contact Name</Label>
          <Input
            id="sub-contact-name"
            placeholder="Primary contact"
            value={form.contact_name}
            onChange={(e) => update("contact_name", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-contact-email">Contact Email</Label>
          <Input
            id="sub-contact-email"
            type="email"
            placeholder="email@example.com"
            value={form.contact_email}
            onChange={(e) => update("contact_email", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-contact-phone">Contact Phone</Label>
          <Input
            id="sub-contact-phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={form.contact_phone}
            onChange={(e) => update("contact_phone", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sub-notes">Notes</Label>
        <Textarea
          id="sub-notes"
          placeholder="Any context for the SourceCo team"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={3}
        />
      </div>

      <Button type="submit" disabled={isSubmitting || !form.company_name.trim()} className="w-full">
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        Submit Referral
      </Button>
    </form>
  );
}
