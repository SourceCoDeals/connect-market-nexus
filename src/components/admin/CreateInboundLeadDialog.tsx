import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
type LeadSource = 'webflow' | 'manual' | 'referral' | 'cold_outreach' | 'networking' | 'linkedin' | 'email';

export interface CreateInboundLeadData {
  name: string;
  email: string;
  company_name?: string;
  phone_number?: string;
  role?: string;
  message?: string;
  source: LeadSource;
  source_form_name?: string;
}

interface CreateInboundLeadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (leadData: CreateInboundLeadData) => void;
  isLoading?: boolean;
}

export const CreateInboundLeadDialog = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false
}: CreateInboundLeadDialogProps) => {
  const [formData, setFormData] = useState<CreateInboundLeadData>({
    name: "",
    email: "",
    company_name: "",
    phone_number: "",
    role: "",
    message: "",
    source: "manual",
    source_form_name: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.email) {
      onConfirm(formData);
      handleReset();
    }
  };

  const handleReset = () => {
    setFormData({
      name: "",
      email: "",
      company_name: "",
      phone_number: "",
      role: "",
      message: "",
      source: "manual",
      source_form_name: "",
    });
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Inbound Lead
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
                required
              />
            </div>
            
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@company.com"
                required
              />
            </div>
            
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Company name"
              />
            </div>
            
            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            
            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Private Equity">Private Equity</SelectItem>
                  <SelectItem value="Family Office">Family Office</SelectItem>
                  <SelectItem value="Corporate Development">Corporate Development</SelectItem>
                  <SelectItem value="Independent Sponsor">Independent Sponsor</SelectItem>
                  <SelectItem value="Search Fund">Search Fund</SelectItem>
                  <SelectItem value="Investment Banking">Investment Banking</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Source */}
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={formData.source}
                onValueChange={(value) => setFormData({ ...formData, source: value as LeadSource })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="webflow">Website Form</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                  <SelectItem value="networking">Networking Event</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="email">Email Campaign</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Source Form Name (for relevant sources) */}
          {(formData.source === 'webflow' || formData.source === 'email') && (
            <div className="space-y-2">
              <Label htmlFor="sourceForm">
                {formData.source === 'webflow' ? 'Form Name' : 'Campaign Name'}
              </Label>
              <Input
                id="sourceForm"
                value={formData.source_form_name}
                onChange={(e) => setFormData({ ...formData, source_form_name: e.target.value })}
                placeholder={formData.source === 'webflow' ? "e.g., Contact Form" : "e.g., Q1 Newsletter"}
              />
            </div>
          )}
          
          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Enter the lead's message or notes..."
              rows={3}
            />
          </div>
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!formData.name || !formData.email || isLoading}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {isLoading ? "Creating..." : "Create Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};