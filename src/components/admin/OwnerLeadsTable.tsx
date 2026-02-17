
import { useState, useEffect, useMemo } from "react";
import { useOwnerLeads, useUpdateOwnerLeadStatus, formatRevenueRange, formatSaleTimeline, OwnerLead } from "@/hooks/admin/use-owner-leads";
import { useUpdateOwnerLeadNotes } from "@/hooks/admin/use-update-owner-lead-notes";
import { useMarkOwnerLeadsViewed } from "@/hooks/admin/use-mark-owner-leads-viewed";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Building2, Phone, Mail, Globe, Calendar, DollarSign, MessageSquare, ExternalLink, Search, Download, StickyNote, Filter } from "lucide-react";
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

function LeadDetailsDialog({ lead, onNotesUpdate }: { lead: OwnerLead; onNotesUpdate: (notes: string) => void }) {
  const [notes, setNotes] = useState(lead.admin_notes || "");
  const [hasChanges, setHasChanges] = useState(false);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setHasChanges(value !== (lead.admin_notes || ""));
  };

  const handleSaveNotes = () => {
    onNotesUpdate(notes);
    setHasChanges(false);
  };

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <a href={lead.business_website.startsWith('http') ? lead.business_website : `https://${lead.business_website}`} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
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

        {/* Admin Notes */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <StickyNote className="h-4 w-4" />
            Admin Notes
          </h4>
          <Textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add internal notes about this lead..."
            className="min-h-[100px]"
          />
          {hasChanges && (
            <Button size="sm" onClick={handleSaveNotes}>
              Save Notes
            </Button>
          )}
        </div>

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
  const updateNotes = useUpdateOwnerLeadNotes();
  const { markAsViewed } = useMarkOwnerLeadsViewed();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [revenueFilter, setRevenueFilter] = useState<string>("all");

  // Mark as viewed when component mounts
  useEffect(() => {
    markAsViewed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter leads
  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    
    return leads.filter((lead) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        lead.name.toLowerCase().includes(searchLower) ||
        lead.email.toLowerCase().includes(searchLower) ||
        (lead.company_name?.toLowerCase().includes(searchLower)) ||
        (lead.phone_number?.includes(searchQuery));
      
      // Status filter
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      
      // Revenue filter
      const matchesRevenue = revenueFilter === "all" || lead.estimated_revenue_range === revenueFilter;
      
      return matchesSearch && matchesStatus && matchesRevenue;
    });
  }, [leads, searchQuery, statusFilter, revenueFilter]);

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredLeads.length) return;

    const headers = ["Name", "Email", "Phone", "Company", "Website", "Revenue", "Timeline", "Status", "Message", "Notes", "Date"];
    const rows = filteredLeads.map((lead) => [
      lead.name,
      lead.email,
      lead.phone_number || "",
      lead.company_name || "",
      lead.business_website || "",
      formatRevenueRange(lead.estimated_revenue_range),
      formatSaleTimeline(lead.sale_timeline),
      lead.status,
      (lead.message || "").replace(/,/g, ";").replace(/\n/g, " "),
      (lead.admin_notes || "").replace(/,/g, ";").replace(/\n/g, " "),
      format(new Date(lead.created_at), "yyyy-MM-dd"),
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `owner-leads-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const handleNotesUpdate = (leadId: string, notes: string) => {
    updateNotes.mutate({ id: leadId, notes });
  };

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
    <div className="space-y-4">
      {/* Filters & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Revenue Filter */}
          <Select value={revenueFilter} onValueChange={setRevenueFilter}>
            <SelectTrigger className="w-[150px]">
              <DollarSign className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Revenue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Revenue</SelectItem>
              <SelectItem value="under_1m">Under $1M</SelectItem>
              <SelectItem value="1m_5m">$1M - $5M</SelectItem>
              <SelectItem value="5m_10m">$5M - $10M</SelectItem>
              <SelectItem value="10m_25m">$10M - $25M</SelectItem>
              <SelectItem value="25m_50m">$25M - $50M</SelectItem>
              <SelectItem value="50m_plus">$50M+</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Export Button */}
        <Button variant="outline" onClick={handleExportCSV} disabled={!filteredLeads.length}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredLeads.length} of {leads.length} leads
      </p>

      {/* Table */}
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
            {filteredLeads.map((lead) => (
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
                    <LeadDetailsDialog 
                      lead={lead} 
                      onNotesUpdate={(notes) => handleNotesUpdate(lead.id, notes)} 
                    />
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
