import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateConnectionRequests } from '@/lib/query-client-helpers';

interface ManualLeadIngestionProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualLeadIngestion = ({ isOpen, onClose }: ManualLeadIngestionProps) => {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    role: '',
    phone: '',
    message: '',
    listing_id: '',
    source: 'webflow' as string,
  });

  // Fetch listings for dropdown
  const { data: listings = [] } = useQuery({
    queryKey: ['admin-listings-for-ingestion'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, internal_company_name, webflow_slug')
        .order('title');
      if (error) throw error;
      return data || [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    setIsSubmitting(true);
    try {
      // Check for existing profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formData.email.toLowerCase())
        .maybeSingle();

      const insertData: Record<string, unknown> = {
        source: formData.source,
        status: 'pending',
        lead_name: formData.name,
        lead_email: formData.email.toLowerCase(),
        lead_company: formData.company || null,
        lead_role: formData.role || null,
        lead_phone: formData.phone || null,
        user_message: formData.message || null,
        source_metadata: {
          manually_ingested: true,
          ingested_at: new Date().toISOString(),
        },
      };

      if (formData.listing_id) insertData.listing_id = formData.listing_id;
      if (profile) insertData.user_id = profile.id;

      const { error } = await supabase.from('connection_requests').insert(insertData);

      if (error) throw error;

      toast({
        title: 'Lead created',
        description: `${formData.name} added as a connection request.`,
      });
      invalidateConnectionRequests(queryClient);
      handleReset();
      onClose();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to create lead',
        description: (err as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: '',
      email: '',
      company: '',
      role: '',
      phone: '',
      message: '',
      listing_id: '',
      source: 'webflow',
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => {
        handleReset();
        onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Manual Lead Ingestion
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lead-name">Name *</Label>
              <Input
                id="lead-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-email">Email *</Label>
              <Input
                id="lead-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@company.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-company">Company</Label>
              <Input
                id="lead-company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-role">Role</Label>
              <Input
                id="lead-role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="e.g. Managing Director"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-source">Source</Label>
              <Select
                value={formData.source}
                onValueChange={(v) => setFormData({ ...formData, source: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="webflow">Webflow (missed)</SelectItem>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                  <SelectItem value="networking">Networking</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-listing">Deal (Listing)</Label>
            <Select
              value={formData.listing_id}
              onValueChange={(v) => setFormData({ ...formData, listing_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a deal..." />
              </SelectTrigger>
              <SelectContent>
                {listings.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.internal_company_name || l.title}
                    {l.webflow_slug ? ` (${l.webflow_slug})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-message">Notes</Label>
            <Textarea
              id="lead-message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Any notes about this lead..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleReset();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name || !formData.email || isSubmitting}>
              <Plus className="h-4 w-4 mr-1" />
              {isSubmitting ? 'Creating...' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
