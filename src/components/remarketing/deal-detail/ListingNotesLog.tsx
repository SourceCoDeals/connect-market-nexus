import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Send,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ListingNote {
  id: string;
  listing_id: string;
  admin_id?: string;
  note: string;
  created_at: string;
  admin?: {
    email: string;
    first_name: string;
    last_name: string;
  };
}

interface ListingNotesLogProps {
  listingId: string;
  maxHeight?: number;
}

export function ListingNotesLog({ listingId, maxHeight = 480 }: ListingNotesLogProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [note, setNote] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery<ListingNote[]>({
    queryKey: ["listing-notes", listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_notes")
        .select(`*, admin:admin_id(email, first_name, last_name)`)
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ListingNote[];
    },
    enabled: !!listingId,
    staleTime: 30_000,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("listing_notes").insert({
        listing_id: listingId,
        admin_id: user?.id,
        note: noteText,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["listing-notes", listingId] });
      toast.success("Note added");
    },
    onError: () => {
      toast.error("Failed to add note");
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from("listing_notes")
        .delete()
        .eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listing-notes", listingId] });
      toast.success("Note deleted");
      setDeletingId(null);
    },
    onError: () => {
      toast.error("Failed to delete note");
      setDeletingId(null);
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
                Notes
                {notes.length > 0 && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {notes.length}
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
                placeholder="Add a note..."
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

            {/* Notes Feed */}
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No notes yet</p>
              </div>
            ) : (
              <div className="overflow-y-auto space-y-3 pr-1" style={{ maxHeight: maxHeight - 220 }}>
                {notes.map((n) => {
                  const adminName = n.admin?.first_name
                    ? `${n.admin.first_name}${n.admin.last_name ? ` ${n.admin.last_name}` : ""}`
                    : n.admin?.email ?? null;
                  const isDeleting = deletingId === n.id;

                  return (
                    <div
                      key={n.id}
                      className="rounded-lg border p-3 space-y-1.5 group relative bg-background"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {adminName && (
                          <span className="text-xs font-medium text-foreground">
                            {adminName}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap flex items-center gap-1.5">
                          <span className="font-medium text-foreground/70">
                            {format(new Date(n.created_at), "MMM d, yyyy · h:mm a")}
                          </span>
                          <span className="text-muted-foreground/50">·</span>
                          <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setDeletingId(n.id);
                            deleteNoteMutation.mutate(n.id);
                          }}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
