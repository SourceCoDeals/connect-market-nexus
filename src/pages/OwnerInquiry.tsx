
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOwnerInquiry } from "@/hooks/use-owner-inquiry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import bradDaughertyImage from '@/assets/brad-daugherty.png';
import sfcLogo from '@/assets/sfc-logo.png';

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 min-h-screen items-center max-w-7xl mx-auto">
          
          {/* Left Column - Form */}
          <div className="flex flex-col justify-center space-y-8">
            {/* Back Link */}
            <Link 
              to="/welcome" 
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Back to selection
            </Link>

            {/* Brand Header */}
            <div className="flex items-center space-x-3 mb-2">
              <img 
                src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
                alt="SourceCo Logo" 
                className="h-8 w-8"
              />
              <div>
                <h1 className="text-xl font-semibold tracking-tight">SourceCo</h1>
                <p className="text-sm text-muted-foreground font-light">Marketplace</p>
              </div>
            </div>

            <Card className="border-none shadow-lg">
              <CardHeader className="space-y-2 pb-6">
                <CardTitle className="text-xl font-semibold">
                  Let's start the conversation
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Tell us about your business. A member of our team will reach out within 24-48 hours.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-5">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name & Email Row */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">
                        Full Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={formData.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder="John Smith"
                        className={`text-sm ${errors.name ? "border-destructive" : ""}`}
                      />
                      {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">
                        Email Address <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder="john@company.com"
                        className={`text-sm ${errors.email ? "border-destructive" : ""}`}
                      />
                      {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                    </div>
                  </div>

                  {/* Phone & Company Row */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">
                        Phone Number <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        placeholder="(555) 123-4567"
                        className={`text-sm ${errors.phone ? "border-destructive" : ""}`}
                      />
                      {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">
                        Company Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={formData.companyName}
                        onChange={(e) => handleChange("companyName", e.target.value)}
                        placeholder="Acme Industries"
                        className={`text-sm ${errors.companyName ? "border-destructive" : ""}`}
                      />
                      {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                    </div>
                  </div>

                  {/* Website (optional) */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">
                      Business Website <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      type="url"
                      value={formData.businessWebsite}
                      onChange={(e) => handleChange("businessWebsite", e.target.value)}
                      placeholder="https://www.yourcompany.com"
                      className="text-sm"
                    />
                  </div>

                  {/* Revenue & Timeline Row */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">
                        Estimated Annual Revenue <span className="text-destructive">*</span>
                      </label>
                      <Select 
                        value={formData.revenueRange} 
                        onValueChange={(value) => handleChange("revenueRange", value)}
                      >
                        <SelectTrigger className={`text-sm ${errors.revenueRange ? "border-destructive" : ""}`}>
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
                      <label className="text-xs font-medium text-foreground">
                        Timeline <span className="text-destructive">*</span>
                      </label>
                      <Select 
                        value={formData.saleTimeline} 
                        onValueChange={(value) => handleChange("saleTimeline", value)}
                      >
                        <SelectTrigger className={`text-sm ${errors.saleTimeline ? "border-destructive" : ""}`}>
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
                    <label className="text-xs font-medium text-foreground">
                      Tell us about your business <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => handleChange("description", e.target.value)}
                      placeholder="Brief description of your business, industry, and what makes it unique..."
                      rows={3}
                      className="text-sm resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button 
                    type="submit" 
                    className="w-full"
                    size="sm"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Submit Inquiry"}
                  </Button>
                </form>
              </CardContent>
              
              <CardFooter className="flex flex-col pt-4">
                <p className="text-xs text-center text-muted-foreground">
                  By submitting, you agree to be contacted by our team.
                </p>
              </CardFooter>
            </Card>

            {/* Alternative CTA */}
            <div className="text-xs text-muted-foreground">
              Looking to acquire a business instead?{" "}
              <Link to="/signup" className="text-primary font-medium hover:underline">
                Create a buyer account
              </Link>
            </div>
          </div>

          {/* Right Column - Value Proposition & Testimonial */}
          <div className="hidden lg:flex flex-col justify-center space-y-8 pl-8">
            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Why Sell with SourceCo?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                  We connect you with qualified buyers who understand your industry—without 
                  the public exposure of listing your business on the open market.
                </p>
              </div>

              <Card className="bg-gradient-to-br from-muted/30 to-muted/10 border border-border/50 shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      <img 
                        src={bradDaughertyImage} 
                        alt="Brad Daughterty"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-2 flex-1 relative">
                      <blockquote className="text-sm text-foreground leading-relaxed italic">
                        "SourceCo's team clearly understood our investment thesis and effectively conveyed our value to owners. Their process resulted in multiple LOIs and a closed deal."
                      </blockquote>
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-foreground">
                          Brad Daughterty
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Chief Financial Officer, <a 
                            href="https://sportsfacilities.com/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline transition-all duration-200"
                          >
                            Sports Facilities Companies
                          </a>
                        </div>
                      </div>
                      <div className="absolute bottom-0 right-0">
                        <img 
                          src={sfcLogo} 
                          alt="Sports Facilities Companies"
                          className="h-6 w-auto opacity-70"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-4 text-xs text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  <span>Confidential, no public listing</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  <span>Pre-qualified buyers who can close</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  <span>No obligation, exploratory conversations welcome</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default OwnerInquiry;
