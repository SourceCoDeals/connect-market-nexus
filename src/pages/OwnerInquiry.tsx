
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOwnerInquiry } from "@/hooks/use-owner-inquiry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2 } from "lucide-react";

const REVENUE_RANGES = [
  { value: "under_1m", label: "Under $1M" },
  { value: "1m_5m", label: "$1M - $5M" },
  { value: "5m_10m", label: "$5M - $10M" },
  { value: "10m_25m", label: "$10M - $25M" },
  { value: "25m_50m", label: "$25M - $50M" },
  { value: "50m_plus", label: "$50M+" },
];

const SALE_TIMELINES = [
  { value: "actively_exploring", label: "Actively exploring now" },
  { value: "within_6_months", label: "Within 6 months" },
  { value: "6_12_months", label: "6-12 months" },
  { value: "1_2_years", label: "1-2 years" },
  { value: "just_exploring", label: "Just exploring options" },
];

const OwnerInquiry = () => {
  const navigate = useNavigate();
  const { submitInquiry, isSubmitting } = useOwnerInquiry();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    businessWebsite: "",
    revenueRange: "",
    saleTimeline: "",
    description: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) newErrors.name = "Full name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    if (!formData.companyName.trim()) newErrors.companyName = "Company name is required";
    if (!formData.revenueRange) newErrors.revenueRange = "Please select a revenue range";
    if (!formData.saleTimeline) newErrors.saleTimeline = "Please select a timeline";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const success = await submitInquiry({
      name: formData.name,
      email: formData.email,
      phone_number: formData.phone,
      company_name: formData.companyName,
      business_website: formData.businessWebsite || null,
      estimated_revenue_range: formData.revenueRange,
      sale_timeline: formData.saleTimeline,
      message: formData.description || null,
    });

    if (success) {
      navigate("/sell/success");
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-sourceco-background">
      {/* Header */}
      <header className="w-full py-6 px-6 border-b border-border/50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/welcome" className="flex items-center gap-3">
            <img 
              src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
              alt="SourceCo Logo" 
              className="h-8 w-8"
            />
            <div>
              <h1 className="text-lg font-bold text-foreground">SourceCo</h1>
            </div>
          </Link>
          <Link 
            to="/welcome"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-12">
        <div className="max-w-xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-sourceco-muted flex items-center justify-center mx-auto mb-6">
              <Building2 className="h-8 w-8 text-sourceco-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
              Let's Start the Conversation
            </h2>
            <p className="text-muted-foreground">
              Tell us about your business and a member of our team will reach out within 24-48 hours.
            </p>
          </div>

          {/* Form */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name & Email Row */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Full Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      placeholder="John Smith"
                      className={errors.name ? "border-destructive" : ""}
                    />
                    {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Email Address <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="john@company.com"
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>
                </div>

                {/* Phone & Company Row */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Phone Number <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="(555) 123-4567"
                      className={errors.phone ? "border-destructive" : ""}
                    />
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Company Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={formData.companyName}
                      onChange={(e) => handleChange("companyName", e.target.value)}
                      placeholder="Acme Industries"
                      className={errors.companyName ? "border-destructive" : ""}
                    />
                    {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                  </div>
                </div>

                {/* Website (optional) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Business Website <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Input
                    type="url"
                    value={formData.businessWebsite}
                    onChange={(e) => handleChange("businessWebsite", e.target.value)}
                    placeholder="https://www.yourcompany.com"
                  />
                </div>

                {/* Revenue & Timeline Row */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Estimated Annual Revenue <span className="text-destructive">*</span>
                    </label>
                    <Select 
                      value={formData.revenueRange} 
                      onValueChange={(value) => handleChange("revenueRange", value)}
                    >
                      <SelectTrigger className={errors.revenueRange ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        {REVENUE_RANGES.map(range => (
                          <SelectItem key={range.value} value={range.value}>
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.revenueRange && <p className="text-xs text-destructive">{errors.revenueRange}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      When are you looking to sell? <span className="text-destructive">*</span>
                    </label>
                    <Select 
                      value={formData.saleTimeline} 
                      onValueChange={(value) => handleChange("saleTimeline", value)}
                    >
                      <SelectTrigger className={errors.saleTimeline ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select timeline" />
                      </SelectTrigger>
                      <SelectContent>
                        {SALE_TIMELINES.map(timeline => (
                          <SelectItem key={timeline.value} value={timeline.value}>
                            {timeline.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.saleTimeline && <p className="text-xs text-destructive">{errors.saleTimeline}</p>}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Tell us about your business <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="Brief description of your business, industry, and what makes it unique..."
                    rows={4}
                  />
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full bg-sourceco-primary hover:bg-sourceco-primary/90 text-sourceco-primary-foreground"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Submit Inquiry"}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By submitting this form, you agree to be contacted by our team regarding your inquiry.
                </p>
              </form>
            </CardContent>
          </Card>

          {/* Alternative CTA */}
          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground">
              Looking to acquire a business instead?{" "}
              <Link to="/signup" className="text-sourceco-primary font-medium hover:underline">
                Create a buyer account
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OwnerInquiry;
