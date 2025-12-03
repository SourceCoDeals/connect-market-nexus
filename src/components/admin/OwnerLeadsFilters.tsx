import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, DollarSign } from "lucide-react";
import { OwnerLead, formatRevenueRange, formatSaleTimeline } from "@/hooks/admin/use-owner-leads";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "meeting_scheduled", label: "Meeting Scheduled" },
  { value: "engaged", label: "Engaged" },
  { value: "not_interested", label: "Not Interested" },
  { value: "closed", label: "Closed" },
];

interface OwnerLeadsFiltersProps {
  leads: OwnerLead[];
  onFilteredLeadsChange: (leads: OwnerLead[]) => void;
}

export function OwnerLeadsFilters({ leads, onFilteredLeadsChange }: OwnerLeadsFiltersProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [revenueFilter, setRevenueFilter] = useState<string>("all");

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        lead.name.toLowerCase().includes(searchLower) ||
        lead.email.toLowerCase().includes(searchLower) ||
        (lead.company_name?.toLowerCase().includes(searchLower)) ||
        (lead.phone_number?.includes(searchQuery));
      
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      const matchesRevenue = revenueFilter === "all" || lead.estimated_revenue_range === revenueFilter;
      
      return matchesSearch && matchesStatus && matchesRevenue;
    });
  }, [leads, searchQuery, statusFilter, revenueFilter]);

  useEffect(() => {
    onFilteredLeadsChange(filteredLeads);
  }, [filteredLeads, onFilteredLeadsChange]);

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

  return (
    <div className="space-y-6 pb-6 border-b">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Filters</h2>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleExportCSV}
          disabled={filteredLeads.length === 0}
          className="gap-2 h-9"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export CSV</span>
        </Button>
      </div>
      
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <Label htmlFor="owner-search" className="text-sm font-medium text-muted-foreground">
              Search leads
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="owner-search"
                placeholder="Search by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 border-border/60 focus:border-primary/40 transition-colors"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 border-border/60 focus:border-primary/40 transition-colors">
                <SelectValue />
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
          </div>

          <div>
            <Label className="text-sm font-medium text-muted-foreground">Revenue</Label>
            <Select value={revenueFilter} onValueChange={setRevenueFilter}>
              <SelectTrigger className="h-10 border-border/60 focus:border-primary/40 transition-colors">
                <SelectValue />
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
        </div>

        <div className="text-sm text-muted-foreground pt-2">
          Showing <span className="font-medium text-foreground">{filteredLeads.length}</span> of <span className="font-medium text-foreground">{leads.length}</span> leads
        </div>
      </div>
    </div>
  );
}
