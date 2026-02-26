import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Users,
  Mail,
  Copy,
  ChevronDown,
  ChevronRight,
  Loader2,
  Archive,
  MoreVertical,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { useDuplicateContacts, type DuplicateGroup, type DuplicateContact } from '@/hooks/admin/use-duplicate-contacts';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const DuplicateContactsPage = () => {
  const { data: duplicateGroups = [], isLoading, error } = useDuplicateContacts();
  const queryClient = useQueryClient();

  // URL-persisted state
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
  const matchTypeFilter = searchParams.get('match') ?? 'all';
  const setMatchTypeFilter = useCallback(
    (v: string) => {
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (v !== 'all') n.set('match', v);
          else n.delete('match');
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const contactTypeFilter = searchParams.get('type') ?? 'all';
  const setContactTypeFilter = useCallback(
    (v: string) => {
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (v !== 'all') n.set('type', v);
          else n.delete('type');
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Local state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [detailContact, setDetailContact] = useState<DuplicateContact | null>(null);

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('contacts')
        .update({ archived: true, updated_at: new Date().toISOString() })
        .eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'duplicate-contacts'] });
      toast({ title: 'Contact archived', description: 'The duplicate contact has been archived.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Archive failed', description: err.message });
    },
  });

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return duplicateGroups.filter((group) => {
      // Match type filter
      if (matchTypeFilter !== 'all' && group.matchType !== matchTypeFilter) return false;

      // Contact type filter
      if (contactTypeFilter !== 'all') {
        const hasType = group.contacts.some((c) => c.contact_type === contactTypeFilter);
        if (!hasType) return false;
      }

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesGroup =
          group.displayName.toLowerCase().includes(q) ||
          group.contacts.some(
            (c) =>
              c.email?.toLowerCase().includes(q) ||
              c.title?.toLowerCase().includes(q) ||
              `${c.first_name} ${c.last_name}`.toLowerCase().includes(q),
          );
        if (!matchesGroup) return false;
      }

      return true;
    });
  }, [duplicateGroups, searchQuery, matchTypeFilter, contactTypeFilter]);

  // Stats
  const stats = useMemo(() => {
    const totalGroups = duplicateGroups.length;
    const totalDuplicateContacts = duplicateGroups.reduce(
      (sum, g) => sum + g.contacts.length,
      0,
    );
    const nameMatches = duplicateGroups.filter((g) => g.matchType === 'exact_name').length;
    const emailMatches = duplicateGroups.filter((g) => g.matchType === 'email').length;
    const noEmailGroups = duplicateGroups.filter((g) =>
      g.contacts.some((c) => !c.email),
    ).length;
    return { totalGroups, totalDuplicateContacts, nameMatches, emailMatches, noEmailGroups };
  }, [duplicateGroups]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(filteredGroups.map((g) => g.key)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">Failed to load duplicate contacts</p>
          <p className="text-xs text-destructive">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Duplicate Contacts</h1>
              <p className="text-sm text-muted-foreground">
                Contacts that share the same name or email address. Review and archive duplicates to
                keep data clean.
              </p>
            </div>
            {!isLoading && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs gap-1">
                  <Copy className="h-3 w-3" />
                  {stats.totalGroups} duplicate groups
                </Badge>
                <Badge variant="outline" className="text-xs gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {stats.noEmailGroups} missing email
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Stats Cards */}
        {!isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatsCard icon={Copy} label="Duplicate Groups" value={stats.totalGroups} />
            <StatsCard
              icon={Users}
              label="Total Duplicated"
              value={stats.totalDuplicateContacts}
            />
            <StatsCard icon={Users} label="Name Matches" value={stats.nameMatches} />
            <StatsCard icon={Mail} label="Email Matches" value={stats.emailMatches} />
            <StatsCard
              icon={AlertTriangle}
              label="Missing Email"
              value={stats.noEmailGroups}
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={matchTypeFilter} onValueChange={setMatchTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Match Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Match Types</SelectItem>
              <SelectItem value="exact_name">Name Match</SelectItem>
              <SelectItem value="email">Email Match</SelectItem>
            </SelectContent>
          </Select>
          <Select value={contactTypeFilter} onValueChange={setContactTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Contact Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="buyer">Buyers</SelectItem>
              <SelectItem value="seller">Sellers</SelectItem>
              <SelectItem value="advisor">Advisors</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          {filteredGroups.length} group{filteredGroups.length !== 1 ? 's' : ''} found
          {duplicateGroups.length !== filteredGroups.length &&
            ` (${duplicateGroups.length} total)`}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Scanning for duplicates...</span>
          </div>
        )}

        {/* No duplicates */}
        {!isLoading && duplicateGroups.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No duplicates found</p>
            <p className="text-sm">All contacts appear to be unique.</p>
          </div>
        )}

        {/* Duplicate Groups */}
        {!isLoading && filteredGroups.length > 0 && (
          <div className="space-y-2">
            {filteredGroups.map((group) => (
              <DuplicateGroupRow
                key={group.key}
                group={group}
                isExpanded={expandedGroups.has(group.key)}
                onToggle={() => toggleGroup(group.key)}
                onArchive={(id) => archiveMutation.mutate(id)}
                onViewDetail={setDetailContact}
                isArchiving={archiveMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailContact} onOpenChange={() => setDetailContact(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Contact Detail</DialogTitle>
            <DialogDescription>
              Full details for this contact record.
            </DialogDescription>
          </DialogHeader>
          {detailContact && <ContactDetailView contact={detailContact} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function DuplicateGroupRow({
  group,
  isExpanded,
  onToggle,
  onArchive,
  onViewDetail,
  isArchiving,
}: {
  group: DuplicateGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onArchive: (id: string) => void;
  onViewDetail: (c: DuplicateContact) => void;
  isArchiving: boolean;
}) {
  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      {/* Group header */}
      <button
        onClick={onToggle}
        className="flex items-center w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
        )}
        <span className="font-medium flex-1">{group.displayName}</span>
        <Badge
          variant={group.matchType === 'exact_name' ? 'default' : 'secondary'}
          className="text-xs mr-2"
        >
          {group.matchType === 'exact_name' ? 'Name Match' : 'Email Match'}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {group.contacts.length} records
        </Badge>
      </button>

      {/* Expanded table */}
      {isExpanded && (
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">
                    <button
                      onClick={() => onViewDetail(contact)}
                      className="hover:underline text-left"
                    >
                      {contact.first_name} {contact.last_name}
                    </button>
                    {contact.is_primary_at_firm && (
                      <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
                        Primary
                      </Badge>
                    )}
                    {contact.is_primary_seller_contact && (
                      <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
                        Primary Seller
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.email ? (
                      <span className="text-sm">{contact.email}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No email</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', contactTypeColor(contact.contact_type))}
                    >
                      {contact.contact_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {contact.title || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {contact.source || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(contact.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetail(contact)}>
                          <ExternalLink className="h-3.5 w-3.5 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onArchive(contact.id)}
                          disabled={isArchiving}
                          className="text-destructive focus:text-destructive"
                        >
                          <Archive className="h-3.5 w-3.5 mr-2" />
                          Archive Duplicate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ContactDetailView({ contact }: { contact: DuplicateContact }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <DetailField label="First Name" value={contact.first_name} />
        <DetailField label="Last Name" value={contact.last_name} />
        <DetailField label="Email" value={contact.email} />
        <DetailField label="Phone" value={contact.phone} />
        <DetailField label="Title" value={contact.title} />
        <DetailField label="Type" value={contact.contact_type} />
        <DetailField label="Source" value={contact.source} />
        <DetailField
          label="Created"
          value={format(new Date(contact.created_at), 'MMM d, yyyy h:mm a')}
        />
        <DetailField label="Listing ID" value={contact.listing_id} />
        <DetailField label="Buyer ID" value={contact.remarketing_buyer_id} />
        <DetailField label="Firm ID" value={contact.firm_id} />
        <DetailField label="LinkedIn" value={contact.linkedin_url} />
      </div>
      <div className="flex gap-2 text-xs">
        {contact.is_primary_at_firm && <Badge variant="outline">Primary at Firm</Badge>}
        {contact.is_primary_seller_contact && <Badge variant="outline">Primary Seller</Badge>}
      </div>
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground font-mono">ID: {contact.id}</p>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="font-medium text-sm truncate">{value || '—'}</p>
    </div>
  );
}

function StatsCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
}

function contactTypeColor(type: string): string {
  switch (type) {
    case 'buyer':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'seller':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'advisor':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'internal':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    default:
      return '';
  }
}

export default DuplicateContactsPage;
