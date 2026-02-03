import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil,
  Loader2,
  Building2,
  ExternalLink,
  Globe,
  MapPin,
  Home,
  Calendar,
  Users,
  Building,
  MapPinned,
  Star,
  Linkedin,
} from "lucide-react";
import { toast } from "sonner";

// US state codes for dropdown
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'Washington DC' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'PR', name: 'Puerto Rico' }, { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

// Canadian province codes
const CA_PROVINCES = [
  { code: 'AB', name: 'Alberta' }, { code: 'BC', name: 'British Columbia' }, { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' }, { code: 'NL', name: 'Newfoundland' }, { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' }, { code: 'NU', name: 'Nunavut' }, { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' }, { code: 'QC', name: 'Quebec' }, { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

interface CompanyOverviewCardProps {
  website: string | null;
  location: string | null; // Legacy marketplace location
  address: string | null; // Legacy full address
  foundedYear: number | null;
  employees: {
    fullTime: number | null;
    partTime: number | null;
  };
  industry: string | null;
  numberOfLocations: number | null;
  locationRadiusRequirement: string | null;
  category: string | null;
  status: string;
  // New structured address fields
  streetAddress?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  addressCountry?: string | null;
  // Google reviews data
  googleReviewCount?: number | null;
  googleRating?: number | null;
  googleMapsUrl?: string | null;
  // LinkedIn data
  linkedinUrl?: string | null;
  linkedinEmployeeCount?: number | null;
  linkedinEmployeeRange?: string | null;
  onSave: (data: {
    website: string;
    address: string;
    foundedYear: number | null;
    industry: string;
    numberOfLocations: number | null;
    locationRadiusRequirement: string;
    // Structured address
    streetAddress: string;
    addressCity: string;
    addressState: string;
    addressZip: string;
    addressCountry: string;
  }) => Promise<void>;
}

export const CompanyOverviewCard = ({
  website,
  location,
  address,
  foundedYear,
  employees,
  industry,
  numberOfLocations,
  locationRadiusRequirement,
  category,
  status,
  streetAddress,
  addressCity,
  addressState,
  addressZip,
  addressCountry,
  googleReviewCount,
  googleRating,
  googleMapsUrl,
  linkedinUrl,
  linkedinEmployeeCount,
  linkedinEmployeeRange,
  onSave,
}: CompanyOverviewCardProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    website: website || "",
    address: address || "",
    foundedYear: foundedYear?.toString() || "",
    industry: industry || "",
    numberOfLocations: numberOfLocations?.toString() || "",
    locationRadiusRequirement: locationRadiusRequirement || "",
    // Structured address
    streetAddress: streetAddress || "",
    addressCity: addressCity || "",
    addressState: addressState || "",
    addressZip: addressZip || "",
    addressCountry: addressCountry || "US",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        website: formData.website,
        address: formData.address,
        foundedYear: formData.foundedYear ? parseInt(formData.foundedYear) : null,
        industry: formData.industry,
        numberOfLocations: formData.numberOfLocations ? parseInt(formData.numberOfLocations) : null,
        locationRadiusRequirement: formData.locationRadiusRequirement,
        streetAddress: formData.streetAddress,
        addressCity: formData.addressCity,
        addressState: formData.addressState,
        addressZip: formData.addressZip,
        addressCountry: formData.addressCountry,
      });
      setIsEditOpen(false);
      toast.success("Company overview updated");
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = () => {
    setFormData({
      website: website || "",
      address: address || "",
      foundedYear: foundedYear?.toString() || "",
      industry: industry || "",
      numberOfLocations: numberOfLocations?.toString() || "",
      locationRadiusRequirement: locationRadiusRequirement || "",
      streetAddress: streetAddress || "",
      addressCity: addressCity || "",
      addressState: addressState || "",
      addressZip: addressZip || "",
      addressCountry: addressCountry || "US",
    });
    setIsEditOpen(true);
  };

  const formatWebsiteDisplay = (url: string | null) => {
    if (!url) return "Not specified";
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  };

  const getWebsiteHref = (url: string | null) => {
    if (!url) return "#";
    if (url.startsWith("http")) return url;
    return `https://${url}`;
  };

  // Format headquarters display - prefer structured address over legacy location
  const getHeadquartersDisplay = () => {
    if (addressCity && addressState) {
      return `${addressCity}, ${addressState}`;
    }
    return location || "Not specified";
  };

  // Format full address display - include zip and country
  const getFullAddressDisplay = () => {
    const parts: string[] = [];
    
    // Line 1: Street address
    if (streetAddress) parts.push(streetAddress);
    
    // Line 2: City, State ZIP
    const cityStateZip: string[] = [];
    if (addressCity) cityStateZip.push(addressCity);
    if (addressState) {
      if (cityStateZip.length > 0) {
        // Append state to city with comma
        cityStateZip[cityStateZip.length - 1] += `, ${addressState}`;
      } else {
        cityStateZip.push(addressState);
      }
    }
    if (addressZip) {
      if (cityStateZip.length > 0) {
        cityStateZip[cityStateZip.length - 1] += ` ${addressZip}`;
      } else {
        cityStateZip.push(addressZip);
      }
    }
    if (cityStateZip.length > 0) parts.push(cityStateZip.join(''));
    
    // Line 3: Country (if not US, or always show for completeness)
    if (addressCountry) {
      const countryDisplay = addressCountry === 'US' ? 'United States' : addressCountry === 'CA' ? 'Canada' : addressCountry;
      parts.push(countryDisplay);
    }
    
    if (parts.length > 0) return parts;
    if (address) return [address];
    return null;
  };

  const fullAddress = getFullAddressDisplay();

  const InfoRow = ({ 
    icon: Icon, 
    label, 
    value, 
  }: { 
    icon: React.ElementType; 
    label: string; 
    value: React.ReactNode; 
  }) => (
    <>
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 flex justify-between items-start gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          <span className="font-medium text-sm text-right">
            {value}
          </span>
        </div>
      </div>
      <Separator />
    </>
  );

  const allStates = [...US_STATES, ...CA_PROVINCES];

  return (
    <>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Overview
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Website */}
          <div className="flex items-start gap-3">
            <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 flex justify-between items-start gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                WEBSITE
              </span>
              {website ? (
                <a
                  href={getWebsiteHref(website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm flex items-center gap-1 text-primary hover:underline"
                >
                  {formatWebsiteDisplay(website)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-sm text-muted-foreground italic">Not specified</span>
              )}
            </div>
          </div>
          <Separator />

          <InfoRow 
            icon={MapPin} 
            label="HEADQUARTERS" 
            value={getHeadquartersDisplay()} 
          />

          <InfoRow 
            icon={Home} 
            label="ADDRESS" 
            value={
              fullAddress ? (
                <div className="text-right max-w-[200px]">
                  {fullAddress.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground italic">Not specified</span>
              )
            } 
          />

          <InfoRow 
            icon={Calendar} 
            label="FOUNDED" 
            value={foundedYear || "Not specified"} 
          />

          <InfoRow 
            icon={Users} 
            label="EMPLOYEES" 
            value={
              employees.fullTime || employees.partTime
                ? `${employees.fullTime ? `${employees.fullTime} FT` : ""}${employees.fullTime && employees.partTime ? " + " : ""}${employees.partTime ? `${employees.partTime} PT` : ""}`
                : "Not specified"
            } 
          />

          {/* LinkedIn Profile */}
          <InfoRow
            icon={Linkedin}
            label="LINKEDIN"
            value={
              linkedinUrl ? (
                <a
                  href={linkedinUrl.startsWith("http") ? linkedinUrl : `https://${linkedinUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/company\//i, "").replace(/\/$/, "")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                "Not specified"
              )
            }
          />

          {/* LinkedIn Employee Count */}
          <InfoRow
            icon={Users}
            label="LINKEDIN EMPLOYEE COUNT"
            value={linkedinEmployeeCount ? linkedinEmployeeCount.toLocaleString() : "Not specified"}
          />

          {/* LinkedIn Employee Range */}
          <InfoRow
            icon={Users}
            label="LINKEDIN EMPLOYEE RANGE"
            value={linkedinEmployeeRange || "Not specified"}
          />

          <InfoRow
            icon={Building}
            label="INDUSTRY"
            value={industry || category || "Not specified"}
          />

          <InfoRow
            icon={Building2}
            label="NUMBER OF LOCATIONS" 
            value={
              numberOfLocations 
                ? `${numberOfLocations}${locationRadiusRequirement ? ` (${locationRadiusRequirement})` : ""}`
                : "Not specified"
            } 
          />

          {/* Google Rating - Always show */}
          <InfoRow
            icon={Star}
            label="GOOGLE RATING"
            value={
              googleRating ? (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{googleRating.toFixed(1)}</span>
                  {googleMapsUrl && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline ml-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </span>
              ) : (
                "Not specified"
              )
            }
          />

          {/* Google Review Count - Always show */}
          <InfoRow
            icon={Star}
            label="GOOGLE REVIEWS"
            value={
              googleReviewCount !== null && googleReviewCount !== undefined
                ? `${googleReviewCount.toLocaleString()} review${googleReviewCount !== 1 ? 's' : ''}`
                : "Not specified"
            }
          />

          {/* Status - without separator after */}
          <div className="flex items-start gap-3">
            <MapPinned className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 flex justify-between items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                STATUS
              </span>
              <Badge variant={status === "active" ? "default" : "secondary"} className="capitalize">
                {status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Company Overview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                placeholder="www.company.com"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="mt-1.5"
              />
            </div>

            {/* Structured Address Section */}
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium">Headquarters Address</Label>
              
              <div>
                <Label htmlFor="streetAddress" className="text-xs text-muted-foreground">Street Address</Label>
                <Input
                  id="streetAddress"
                  placeholder="123 Main Street, Suite 100"
                  value={formData.streetAddress}
                  onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="addressCity" className="text-xs text-muted-foreground">City</Label>
                  <Input
                    id="addressCity"
                    placeholder="Dallas"
                    value={formData.addressCity}
                    onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="addressState" className="text-xs text-muted-foreground">State</Label>
                  <Select
                    value={formData.addressState}
                    onValueChange={(value) => setFormData({ ...formData, addressState: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {allStates.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.code} - {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="addressZip" className="text-xs text-muted-foreground">ZIP Code</Label>
                  <Input
                    id="addressZip"
                    placeholder="75201"
                    value={formData.addressZip}
                    onChange={(e) => setFormData({ ...formData, addressZip: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="addressCountry" className="text-xs text-muted-foreground">Country</Label>
                  <Select
                    value={formData.addressCountry}
                    onValueChange={(value) => setFormData({ ...formData, addressCountry: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="foundedYear">Founded Year</Label>
                <Input
                  id="foundedYear"
                  type="number"
                  placeholder="2005"
                  value={formData.foundedYear}
                  onChange={(e) => setFormData({ ...formData, foundedYear: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="numberOfLocations">Locations</Label>
                <Input
                  id="numberOfLocations"
                  type="number"
                  placeholder="5"
                  value={formData.numberOfLocations}
                  onChange={(e) => setFormData({ ...formData, numberOfLocations: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                placeholder="e.g., Collision Repair"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="radiusReq">Location Radius Requirement</Label>
              <Input
                id="radiusReq"
                placeholder="e.g., within 50 miles"
                value={formData.locationRadiusRequirement}
                onChange={(e) =>
                  setFormData({ ...formData, locationRadiusRequirement: e.target.value })
                }
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CompanyOverviewCard;
