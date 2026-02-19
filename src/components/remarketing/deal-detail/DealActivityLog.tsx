import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ClipboardList,
  Send,
  Loader2,
  StickyNote,
  ArrowRightLeft,
  FileCheck,
  CheckSquare,
  UserCog,
  Star,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DealActivity {
  id: string;
  deal_id: string;
  admin_id?: string;
  activity_type: string;
  title: string;
  description?: string;
  metadata?: any;
  created_at: string;
  admin?: {
    email: string;
    first_name: string;
    last_name: string;
  };
}

interface DealActivityLogProps {
  dealId: string;
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  follow_up: <StickyNote className="h-3.5 w-3.5" />,
  stage_change: <ArrowRightLeft className="h-3.5 w-3.5" />,
  nda_status_changed: <FileCheck className="h-3.5 w-3.5" />,
  nda_email_sent: <FileCheck className="h-3.5 w-3.5" />,
  fee_agreement_status_changed: <FileCheck className="h-3.5 w-3.5" />,
  fee_agreement_email_sent: <FileCheck className="h-3.5 w-3.5" />,
  task_created: <CheckSquare className="h-3.5 w-3.5" />,
  task_completed: <CheckSquare className="h-3.5 w-3.5" />,
  task_assigned: <UserCog className="h-3.5 w-3.5" />,
  assignment_changed: <UserCog className="h-3.5 w-3.5" />,
  deal_updated: <Star className="h-3.5 w-3.5" />,
  deal_created: <Star className="h-3.5 w-3.5" />,
};

const ACTIVITY_COLORS: Record<string, string> = {
  follow_up: "bg-blue-50 text-blue-700 border-blue-200",
  stage_change: "bg-purple-50 text-purple-700 border-purple-200",
  nda_status_changed: "bg-amber-50 text-amber-700 border-amber-200",
  nda_email_sent: "bg-amber-50 text-amber-700 border-amber-200",
  fee_agreement_status_changed: "bg-green-50 text-green-700 border-green-200",
  fee_agreement_email_sent: "bg-green-50 text-green-700 border-green-200",
  task_created: "bg-slate-50 text-slate-700 border-slate-200",
  task_completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  task_assigned: "bg-slate-50 text-slate-700 border-slate-200",
  assignment_changed: "bg-slate-50 text-slate-700 border-slate-200",
  deal_updated: "bg-muted text-muted-foreground border-border",
  deal_created: "bg-muted text-muted-foreground border-border",
};

function getActivityLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DealActivityLog({ dealId }: DealActivityLogProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading } = useQuery<DealActivity[]>({
    queryKey: ["deal-activities", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_activities")
        .select(`*, admin:admin_id(email, first_name, last_name)`)
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DealActivity[];
    },
    enabled: !!dealId,
    staleTime: 30_000,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("deal_activities").insert({
        deal_id: dealId,
        admin_id: user?.id,
        activity_type: "follow_up",
        title: "Note added",
        description: noteText,
        metadata: {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["deal-activities", dealId] });
      toast.success("Note added");
    },
    onError: () => {
      toast.error("Failed to add note");
    },
  });

  const handleSubmit = () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    addNoteMutation.mutate(trimmed);
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Activity &amp; Notes
                {activities.length > 0 && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {activities.length}
                  </Badge>
                )}
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Note Input */}
            <div className="space-y-2">
              <Textarea
                placeholder="Add a note, update, or follow-up..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[80px] resize-y text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleSubmit();
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Press Cmd+Enter to submit
                </p>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!note.trim() || addNoteMutation.isPending}
                >
                  {addNoteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Add Note
                </Button>
              </div>
            </div>

            {/* Activity Feed */}
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No activity yet</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[500px] pr-2">
                <div className="space-y-3">
                  {activities.map((activity) => {
                    const icon =
                      ACTIVITY_ICONS[activity.activity_type] ?? (
                        <Clock className="h-3.5 w-3.5" />
                      );
                    const colorClass =
                      ACTIVITY_COLORS[activity.activity_type] ??
                      "bg-muted text-muted-foreground border-border";
                    const adminName = activity.admin?.first_name
                      ? `${activity.admin.first_name}${activity.admin.last_name ? ` ${activity.admin.last_name}` : ""}`
                      : activity.admin?.email ?? null;

                    const isNote = activity.activity_type === "follow_up";

                    return (
                      <div
                        key={activity.id}
                        className={`rounded-lg border p-3 space-y-1.5 ${isNote ? "bg-background" : "bg-muted/30"}`}
                      >
                        {/* Header row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-xs flex items-center gap-1 ${colorClass}`}
                          >
                            {icon}
                            {getActivityLabel(activity.activity_type)}
                          </Badge>
                          {adminName && (
                            <span className="text-xs text-muted-foreground">
                              {adminName}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap" title={format(new Date(activity.created_at), "PPpp")}>
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </span>
                        </div>

                        {/* Content */}
                        {isNote && activity.description ? (
                          <p className="text-sm whitespace-pre-wrap">{activity.description}</p>
                        ) : (
                          <>
                            {activity.title && activity.title !== "Note added" && (
                              <p className="text-sm font-medium">{activity.title}</p>
                            )}
                            {activity.description && (
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {activity.description}
                              </p>
                            )}
                          </>
                        )}

                        {/* Absolute timestamp */}
                        <p className="text-xs text-muted-foreground/60">
                          {format(new Date(activity.created_at), "MMM d, yyyy · h:mm a")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
