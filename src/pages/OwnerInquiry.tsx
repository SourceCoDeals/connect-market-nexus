
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOwnerInquiry } from "@/hooks/use-owner-inquiry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthLayout } from "@/components/layout/AuthLayout";
import bradDaughertyImage from '@/assets/brad-daugherty.png';
import sfcLogo from '@/assets/sfc-logo.png';
import { isValidUrlFormat, processUrl } from "@/lib/url-utils";

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
    // Validate business website format if provided
    if (formData.businessWebsite && !isValidUrlFormat(formData.businessWebsite)) {
      newErrors.businessWebsite = "Please enter a valid website (e.g., yourcompany.com)";
    }

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
      business_website: formData.businessWebsite ? processUrl(formData.businessWebsite) : null,
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

  const rightContent = (
    <div className="space-y-6 pr-8">
      {/* Welcome Header */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Welcome to SourceCo
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          We connect business owners with qualified buyers who understand your industry, without 
          the public exposure of listing on the open market.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Our team will reach out within 1-4 hours to learn about your goals and discuss 
          your options, whether you are ready to sell now or just exploring, <span className="font-semibold text-foreground">at no cost to you</span>.
        </p>
      </div>

      {/* Testimonial */}
      <Card className="bg-background/80 border border-border/50 shadow-sm">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
              <img 
                src={bradDaughertyImage} 
                alt="Brad Daughterty"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-1.5 flex-1 relative">
              <blockquote className="text-xs text-foreground leading-relaxed italic">
                "SourceCo's team clearly understood our investment thesis and effectively 
                conveyed our value to owners. Their process resulted in multiple LOIs and 
                a closed deal."
              </blockquote>
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-foreground">
                  Brad Daughterty
                </div>
                <div className="text-[10px] text-muted-foreground">
                  CFO, <a 
                    href="https://sportsfacilities.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Sports Facilities Companies
                  </a>
                </div>
              </div>
              <div className="absolute bottom-0 right-0">
                <img 
                  src={sfcLogo} 
                  alt="Sports Facilities Companies"
                  className="h-4 w-auto opacity-60"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Value Props */}
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center space-x-2">
          <div className="w-1 h-1 rounded-full bg-primary/40" />
          <span>Confidential, no public listing</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-1 h-1 rounded-full bg-primary/40" />
          <span>Pre-qualified buyers who can close</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-1 h-1 rounded-full bg-primary/40" />
          <span>No obligation, exploratory conversations welcome</span>
        </div>
      </div>
    </div>
  );

  return (
    <AuthLayout 
      rightContent={rightContent}
      showBackLink
      backLinkTo="/welcome"
      backLinkText="Back to selection"
    >
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="space-y-1 pb-6 px-0">
          <CardTitle className="text-xl font-semibold tracking-tight">
            Let's start the conversation
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            A member of our team will reach out within 1-4 hours.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="px-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name & Email Row */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Full Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="John Smith"
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Email Address</label>
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
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Phone Number</label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="(555) 123-4567"
                  className={errors.phone ? "border-destructive" : ""}
                />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Company Name</label>
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
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Business Website</label>
              <Input
                value={formData.businessWebsite}
                onChange={(e) => handleChange("businessWebsite", e.target.value)}
                placeholder="yourcompany.com"
                className={errors.businessWebsite ? "border-destructive" : ""}
              />
              {errors.businessWebsite && <p className="text-xs text-destructive">{errors.businessWebsite}</p>}
            </div>

            {/* Revenue & Timeline Row */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Estimated Annual Revenue</label>
                <Select 
                  value={formData.revenueRange} 
                  onValueChange={(value) => handleChange("revenueRange", value)}
                >
                  <SelectTrigger className={errors.revenueRange ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select..." />
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
              
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Timeline</label>
                <Select 
                  value={formData.saleTimeline} 
                  onValueChange={(value) => handleChange("saleTimeline", value)}
                >
                  <SelectTrigger className={errors.saleTimeline ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select..." />
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
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Tell us about your business</label>
              <Textarea
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Brief description of your business, industry, and what makes it unique..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full text-sm font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Inquiry"}
            </Button>
            
            <p className="text-xs text-center text-muted-foreground pt-1">
              By submitting, you agree to be contacted by our team.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Alternative CTA */}
      <div className="text-xs text-muted-foreground mt-6">
        Looking to acquire a business instead?{" "}
        <Link to="/signup" className="text-primary font-medium hover:underline">
          Create a buyer account
        </Link>
      </div>
    </AuthLayout>
  );
};

export default OwnerInquiry;
