import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Download, X } from "lucide-react";
import type { NonMarketplaceUser } from "@/types/non-marketplace-user";
import { PushToDialerModal } from "@/components/remarketing/PushToDialerModal";

interface BulkContactActionsProps {
  selectedUsers: NonMarketplaceUser[];
  onClearSelection: () => void;
}

export const BulkContactActions = ({
  selectedUsers,
  onClearSelection,
}: BulkContactActionsProps) => {
  const [isDialerOpen, setIsDialerOpen] = useState(false);

  if (selectedUsers.length === 0) return null;

  const ndaSigned = selectedUsers.filter((u) => u.nda_status === "signed").length;
  const feeSigned = selectedUsers.filter((u) => u.fee_agreement_status === "signed").length;
  const withPhone = selectedUsers.filter((u) => u.phone).length;

  const handleExportCsv = () => {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Company",
      "Role",
      "Source",
      "NDA Status",
      "Fee Agreement Status",
      "Deals",
      "Requests",
      "Leads",
      "First Contact",
      "Last Activity",
    ];
    const rows = selectedUsers.map((u) => [
      u.name,
      u.email,
      u.phone || "",
      u.company || "",
      u.role || "",
      u.sources.join(", "),
      u.nda_status || "none",
      u.fee_agreement_status || "none",
      u.deals_count,
      u.connection_requests_count,
      u.inbound_leads_count,
      u.created_at ? new Date(u.created_at).toLocaleDateString() : "",
      u.last_activity_date ? new Date(u.last_activity_date).toLocaleDateString() : "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `buyer-contacts-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Collect source_ids for the dialer push
  const contactIds = selectedUsers.map((u) => u.source_id);

  return (
    <>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm">
              {selectedUsers.length} contact{selectedUsers.length !== 1 ? "s" : ""} selected
            </Badge>

            <div className="flex items-center gap-2">
              {withPhone > 0 && (
                <Button
                  size="sm"
                  onClick={() => setIsDialerOpen(true)}
                  className="flex items-center gap-1.5"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Push {withPhone} to Dialer
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span>{ndaSigned} with NDA</span>
          <span>{feeSigned} with Fee Agmt</span>
          <span>{withPhone} with phone</span>
        </div>
      </div>

      <PushToDialerModal
        open={isDialerOpen}
        onOpenChange={setIsDialerOpen}
        contactIds={contactIds}
        contactCount={withPhone}
        entityType="buyer_contacts"
      />
    </>
  );
};
