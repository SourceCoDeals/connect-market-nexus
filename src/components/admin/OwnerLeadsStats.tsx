import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { OwnerLead } from "@/hooks/admin/use-owner-leads";
import { Users, Clock, CheckCircle, MessageSquare } from "lucide-react";

interface OwnerLeadsStatsProps {
  leads: OwnerLead[];
}

export function OwnerLeadsStats({ leads }: OwnerLeadsStatsProps) {
  const stats = useMemo(() => {
    const total = leads.length;
    const newLeads = leads.filter(l => l.status === "new").length;
    const contacted = leads.filter(l => l.status === "contacted").length;
    const engaged = leads.filter(l => ["meeting_scheduled", "engaged"].includes(l.status)).length;
    
    return { total, newLeads, contacted, engaged };
  }, [leads]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground/50" />
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">New</p>
              <p className="text-2xl font-bold text-blue-600">{stats.newLeads}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-600/50" />
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Contacted</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.contacted}</p>
            </div>
            <MessageSquare className="h-8 w-8 text-yellow-600/50" />
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Engaged</p>
              <p className="text-2xl font-bold text-green-600">{stats.engaged}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600/50" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
