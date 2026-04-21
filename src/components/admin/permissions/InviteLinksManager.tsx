import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Plus, Copy, Link2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { CreateInviteLinkDialog } from './CreateInviteLinkDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const BASE_URL = 'https://marketplace.sourcecodeals.com';

interface InviteLink {
  id: string;
  token: string;
  label: string | null;
  allowed_email_domain: string | null;
  created_by: string | null;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
}

function getStatus(link: InviteLink): 'active' | 'used' | 'expired' {
  if (link.used_at) return 'used';
  if (new Date(link.expires_at) < new Date()) return 'expired';
  return 'active';
}

function StatusBadge({ status }: { status: 'active' | 'used' | 'expired' }) {
  switch (status) {
    case 'active':
      return (
        <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">
          <Clock className="h-3 w-3 mr-1" /> Active
        </Badge>
      );
    case 'used':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Used
        </Badge>
      );
    case 'expired':
      return (
        <Badge variant="secondary">
          <XCircle className="h-3 w-3 mr-1" /> Expired
        </Badge>
      );
  }
}

export function InviteLinksManager() {
  const [createOpen, setCreateOpen] = useState(false);

  const {
    data: links,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['invite-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invite_links')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as InviteLink[];
    },
  });

  const copyLink = (token: string, allowedDomain?: string | null) => {
    let url = `${BASE_URL}/signup?invite=${token}`;
    if (allowedDomain) {
      url += `&domain=${encodeURIComponent(allowedDomain)}`;
    }
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied!', description: 'Invite link copied to clipboard.' });
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Single-use invite links that pre-approve users on signup.
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Invite Link
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
      ) : !links?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No invite links yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => {
                const status = getStatus(link);
                return (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium text-sm">
                      {link.label || <span className="text-muted-foreground italic">No label</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {link.allowed_email_domain ? (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">
                          @{link.allowed_email_domain}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">General</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(link.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(link.expires_at)}
                    </TableCell>
                    <TableCell>
                      {status === 'active' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyLink(link.token, link.allowed_email_domain)}
                          title="Copy invite link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateInviteLinkDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => refetch()}
      />
    </div>
  );
}
