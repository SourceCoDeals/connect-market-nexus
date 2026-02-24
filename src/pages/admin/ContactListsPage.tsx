import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ListChecks,
  Search,
  Phone,
  MoreHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useContactLists, useDeleteContactList } from "@/hooks/admin/use-contact-lists";

const ContactListsPage = () => {
  const { data: lists = [], isLoading } = useContactLists();
  const deleteMutation = useDeleteContactList();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLists = lists.filter((list) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      list.name.toLowerCase().includes(q) ||
      list.description?.toLowerCase().includes(q) ||
      list.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Contact Lists</h1>
              <p className="text-sm text-muted-foreground">
                Saved contact lists for outreach campaigns and PhoneBurner export.
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {lists.length} list{lists.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search lists by name or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border overflow-hidden">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array(4)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="h-14 bg-muted/30 rounded-md animate-pulse" />
                ))}
            </div>
          ) : filteredLists.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm font-medium">No contact lists yet</p>
              <p className="text-xs mt-1">
                Select contacts from the Buyer Contacts page and click "Save as List"
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>List Name</TableHead>
                  <TableHead className="text-center">Contacts</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Pushed</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLists.map((list) => (
                  <TableRow key={list.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Link
                        to={`/admin/lists/${list.id}`}
                        className="font-medium text-sm hover:underline"
                      >
                        {list.name}
                      </Link>
                      {list.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {list.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs gap-1 font-normal">
                        <Users className="h-3 w-3" />
                        {list.contact_count}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="text-xs capitalize"
                      >
                        {list.list_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {list.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-[10px] font-normal px-1.5 py-0"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {list.tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{list.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(list.created_at), "MMM d, yyyy")}
                        </span>
                        {list.created_by_name && (
                          <span className="text-[10px] text-muted-foreground/70">
                            by {list.created_by_name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {list.last_pushed_at ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {formatDistanceToNow(new Date(list.last_pushed_at), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/lists/${list.id}`}>
                              <Users className="h-4 w-4 mr-2" />
                              View Members
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteMutation.mutate(list.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Archive List
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactListsPage;
