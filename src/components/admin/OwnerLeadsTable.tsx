
import { useState } from "react";
import { useOwnerLeads, useUpdateOwnerLeadStatus, formatRevenueRange, formatSaleTimeline, OwnerLead } from "@/hooks/admin/use-owner-leads";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Building2, Phone, Mail, Globe, Calendar, DollarSign, MessageSquare, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-100 text-blue-800" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-100 text-yellow-800" },
  { value: "meeting_scheduled", label: "Meeting Scheduled", color: "bg-purple-100 text-purple-800" },
  { value: "engaged", label: "Engaged", color: "bg-green-100 text-green-800" },
  { value: "not_interested", label: "Not Interested", color: "bg-gray-100 text-gray-800" },
  { value: "closed", label: "Closed", color: "bg-emerald-100 text-emerald-800" },
];

function getStatusBadge(status: string) {
  const statusOption = STATUS_OPTIONS.find(s => s.value === status);
  return (
    <Badge variant="outline" className={statusOption?.color || "bg-gray-100 text-gray-800"}>
      {statusOption?.label || status}
    </Badge>
  );
}

function LeadDetailsDialog({ lead }: { lead: OwnerLead }) {
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-sourceco-primary" />
          {lead.company_name || "Unknown Company"}
        </DialogTitle>
      </DialogHeader>
      
      <div className="space-y-4 mt-4">
        {/* Contact Info */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
          <div className="grid gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{lead.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a>
            </div>
            {lead.phone_number && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <a href={`tel:${lead.phone_number}`} className="hover:underline">{lead.phone_number}</a>
              </div>
            )}
            {lead.business_website && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4" />
                <a href={lead.business_website} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                  {lead.business_website} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Business Info */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Business Details</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="text-sm font-medium">{formatRevenueRange(lead.estimated_revenue_range)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Timeline</p>
                <p className="text-sm font-medium">{formatSaleTimeline(lead.sale_timeline)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        {lead.message && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Message
            </h4>
            <p className="text-sm bg-muted/50 p-3 rounded-md">{lead.message}</p>
          </div>
        )}

        {/* Meta */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          Submitted {format(new Date(lead.created_at), "MMM d, yyyy 'at' h:mm a")}
        </div>
      </div>
    </DialogContent>
  );
}

export function OwnerLeadsTable() {
  const { data: leads, isLoading, error } = useOwnerLeads();
  const updateStatus = useUpdateOwnerLeadStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        Error loading owner leads. Please try again.
      </div>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-1">No owner inquiries yet</h3>
        <p className="text-sm text-muted-foreground">
          Owner inquiries from the /sell form will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contact</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Revenue</TableHead>
            <TableHead>Timeline</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.email}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {lead.company_name || "—"}
                </div>
              </TableCell>
              <TableCell>{formatRevenueRange(lead.estimated_revenue_range)}</TableCell>
              <TableCell>{formatSaleTimeline(lead.sale_timeline)}</TableCell>
              <TableCell>
                <Select
                  value={lead.status}
                  onValueChange={(value) => updateStatus.mutate({ id: lead.id, status: value })}
                >
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue>{getStatusBadge(lead.status)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {format(new Date(lead.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">View</Button>
                  </DialogTrigger>
                  <LeadDetailsDialog lead={lead} />
                </Dialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
