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
} from "lucide-react";
import { toast } from "sonner";

interface CompanyOverviewCardProps {
  website: string | null;
  location: string | null;
  address: string | null;
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
  onSave: (data: {
    website: string;
    address: string;
    foundedYear: number | null;
    industry: string;
    numberOfLocations: number | null;
    locationRadiusRequirement: string;
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

  const InfoRow = ({ 
    icon: Icon, 
    label, 
    value, 
    isLink = false 
  }: { 
    icon: React.ElementType; 
    label: string; 
    value: React.ReactNode; 
    isLink?: boolean;
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
            value={location || "Not specified"} 
          />

          <InfoRow 
            icon={Home} 
            label="ADDRESS" 
            value={
              <span className="max-w-[200px] text-right">
                {address || "Not specified"}
              </span>
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
        <DialogContent className="max-w-md">
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
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="123 Main St, City, State"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="mt-1.5"
              />
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
