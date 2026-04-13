import { useState, useCallback, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ListChecks,
  Search,
  Phone,
  MoreHorizontal,
  Trash2,
  Users,
  Plus,
  Loader2,
  Copy,
  Merge,
  Minus,
  X,
  Zap,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  useContactLists,
  useDeleteContactList,
  useCreateContactList,
} from '@/hooks/admin/use-contact-lists';
import { useCloneList } from '@/hooks/admin/use-list-operations';
import { ListCombineDialog } from '@/components/admin/lists/ListCombineDialog';
import type { ListOperation } from '@/components/admin/lists/ListCombineDialog';
import { CreateSmartListDialog } from '@/components/admin/lists/CreateSmartListDialog';
import { useAICommandCenterContext } from '@/components/ai-command-center/AICommandCenterProvider';
import { useAIUIActionHandler } from '@/hooks/useAIUIActionHandler';

const ContactListsPage = () => {
  const navigate = useNavigate();
  const { data: lists = [], isLoading } = useContactLists();
  const deleteMutation = useDeleteContactList();
  const createList = useCreateContactList();
  const cloneList = useCloneList();

  const [createOpen, setCreateOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [combineOpen, setCombineOpen] = useState(false);
  const [combineOp, setCombineOp] = useState<ListOperation>('merge');
  const [smartListOpen, setSmartListOpen] = useState(false);

  // Register AI Command Center context
  const { setPageContext } = useAICommandCenterContext();
  useEffect(() => {
    setPageContext({ page: 'contact_lists', entity_type: 'contacts' });
  }, [setPageContext]);

  useAIUIActionHandler({ table: 'contacts' });

  // URL-persisted search
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const setSearchQuery = useCallback(
    (v: string) => {
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (v) n.set('q', v);
          else n.delete('q');
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const filteredLists = lists.filter((list) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      list.name.toLowerCase().includes(q) ||
      list.description?.toLowerCase().includes(q) ||
      list.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const selectedLists = useMemo(
    () => filteredLists.filter((l) => selectedIds.has(l.id)),
    [filteredLists, selectedIds],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLists.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLists.map((l) => l.id)));
    }
  };

  const openCombine = (op: ListOperation) => {
    setCombineOp(op);
    setCombineOpen(true);
  };

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    createList.mutate(
      { name: newListName.trim(), list_type: 'mixed', members: [] },
      {
        onSuccess: (data) => {
          setCreateOpen(false);
          setNewListName('');
          navigate(`/admin/lists/${data.id}`);
        },
      },
    );
  };

  const handleClone = (listId: string, listName: string) => {
    cloneList.mutate({ sourceId: listId, name: `${listName} (Copy)` });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="px-4 md:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Lists</h1>
              <p className="text-sm text-muted-foreground">
                Saved lists for outreach campaigns and PhoneBurner export.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-xs">
                {lists.length} list{lists.length !== 1 ? 's' : ''}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => setSmartListOpen(true)}>
                <Zap className="h-4 w-4 mr-1" />
                Smart List
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New List
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-6 space-y-6">
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

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <Badge variant="secondary" className="text-sm">
              {selectedIds.size} selected
            </Badge>
            {selectedIds.size >= 2 && (
              <>
                <Button size="sm" variant="outline" onClick={() => openCombine('merge')}>
                  <Merge className="h-3.5 w-3.5 mr-1.5" />
                  Merge
                </Button>
                <Button size="sm" variant="outline" onClick={() => openCombine('subtract')}>
                  <Minus className="h-3.5 w-3.5 mr-1.5" />
                  Subtract
                </Button>
                <Button size="sm" variant="outline" onClick={() => openCombine('intersect')}>
                  <ListChecks className="h-3.5 w-3.5 mr-1.5" />
                  Intersect
                </Button>
              </>
            )}
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          </div>
        )}

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
              <p className="text-sm font-medium">No lists yet</p>
              <p className="text-xs mt-1">Create a new list to get started.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                New List
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        selectedIds.size === filteredLists.length && filteredLists.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
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
                      <Checkbox
                        checked={selectedIds.has(list.id)}
                        onCheckedChange={() => toggleSelect(list.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Link
                          to={`/admin/lists/${list.id}`}
                          className="font-medium text-sm hover:underline"
                        >
                          {list.name}
                        </Link>
                        {list.is_smart_list && (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-0.5 px-1.5 py-0 text-amber-600 border-amber-300"
                          >
                            <Zap className="h-2.5 w-2.5" />
                            Smart
                          </Badge>
                        )}
                      </div>
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
                      <Badge variant="secondary" className="text-xs capitalize">
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
                          {format(new Date(list.created_at), 'MMM d, yyyy')}
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
                          <DropdownMenuItem onClick={() => handleClone(list.id, list.name)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Clone List
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

      {/* Create List Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) setNewListName('');
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="new-list-name">List Name *</Label>
            <Input
              id="new-list-name"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="e.g., Q1 Seller Outreach"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateList();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateList}
              disabled={!newListName.trim() || createList.isPending}
            >
              {createList.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create List
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Smart List Dialog */}
      <CreateSmartListDialog open={smartListOpen} onOpenChange={setSmartListOpen} />

      {/* Combine Lists Dialog */}
      <ListCombineDialog
        open={combineOpen}
        onOpenChange={(v) => {
          setCombineOpen(v);
          if (!v) setSelectedIds(new Set());
        }}
        selectedLists={selectedLists}
        defaultOperation={combineOp}
      />
    </div>
  );
};

export default ContactListsPage;
