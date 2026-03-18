import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  ExternalLink,
  User,
  Building,
  Calendar,
  Hash,
  Mail,
  MessageSquare,
  LinkIcon,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  useSmartleadInboxItem,
  useRecategorizeInbox,
  useLinkInboxToDeal,
} from '@/hooks/smartlead/use-smartlead-inbox';
import { CreateDealFromReplyDialog } from '@/components/admin/smartlead/CreateDealFromReplyDialog';
import { supabase } from '@/integrations/supabase/client';
...
export default function SmartleadResponseDetail() {
  const { inboxId } = useParams<{ inboxId: string }>();
  const navigate = useNavigate();
  const { data: item, isLoading } = useSmartleadInboxItem(inboxId);
  const recategorize = useRecategorizeInbox();
  const linkToDeal = useLinkInboxToDeal();
  const [showCreateDealDialog, setShowCreateDealDialog] = useState(false);
  const [isResolvingDeal, setIsResolvingDeal] = useState(false);
...
  const handleUnlinkDeal = () => {
    linkToDeal.mutate(
      { id: item.id, dealId: null },
      { onSuccess: () => toast.success('Deal unlinked') },
    );
  };

  const companyFromEmail = (email: string) => {
    if (!email || !email.includes('@')) return '';
    const domain = email.split('@')[1]?.split('.')[0] || '';
    if (
      ['gmail', 'yahoo', 'hotmail', 'outlook', 'aol', 'icloud', 'mail', 'protonmail'].includes(
        domain.toLowerCase(),
      )
    ) {
      return '';
    }
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  };

  const resolveLinkedDealRoute = async (): Promise<
    | { kind: 'listing'; id: string }
    | { kind: 'pipeline'; id: string }
    | null
  > => {
    const linkedId = item.linked_deal_id ? String(item.linked_deal_id) : '';

    if (linkedId) {
      const { data: listingById, error: listingError } = await supabase
        .from('listings')
        .select('id')
        .eq('id', linkedId)
        .maybeSingle();
      if (listingError) throw listingError;
      if (listingById) return { kind: 'listing', id: listingById.id };

      const { data: pipelineById, error: pipelineError } = await supabase
        .from('deal_pipeline')
        .select('id')
        .eq('id', linkedId)
        .maybeSingle();
      if (pipelineError) throw pipelineError;
      if (pipelineById) return { kind: 'pipeline', id: pipelineById.id };
    }

    const remarketingSources = ['captarget', 'gp_partners', 'sourceco'];
    const candidateEmails = [item.to_email, item.sl_lead_email, item.from_email]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    for (const email of candidateEmails) {
      const { data: listingByEmail, error: listingError } = await supabase
        .from('listings')
        .select('id')
        .eq('main_contact_email', email)
        .in('deal_source', remarketingSources)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (listingError) throw listingError;
      if (listingByEmail) return { kind: 'listing', id: listingByEmail.id };
    }

    const companyGuess = companyFromEmail(String(item.to_email || item.sl_lead_email || ''));
    if (companyGuess) {
      const { data: listingByCompany, error: listingError } = await supabase
        .from('listings')
        .select('id')
        .or(`internal_company_name.ilike.%${companyGuess}%,title.ilike.%${companyGuess}%`)
        .in('deal_source', remarketingSources)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (listingError) throw listingError;
      if (listingByCompany) return { kind: 'listing', id: listingByCompany.id };
    }

    return null;
  };

  const handleViewDeal = async () => {
    setIsResolvingDeal(true);
    try {
      const resolved = await resolveLinkedDealRoute();

      if (!resolved) {
        if (item.linked_deal_id) {
          linkToDeal.mutate({ id: item.id, dealId: null });
        }
        toast.error('This linked deal no longer exists. Recreate it from this reply.');
        return;
      }

      if (resolved.kind === 'listing') {
        if (resolved.id !== item.linked_deal_id) {
          linkToDeal.mutate({ id: item.id, dealId: resolved.id });
        }
        navigate(`/admin/deals/${resolved.id}`);
        return;
      }

      navigate(`/admin/deals/pipeline?deal=${resolved.id}`);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to open linked deal');
    } finally {
      setIsResolvingDeal(false);
    }
  };
...
              {item.linked_deal_id ? (
                <div className="space-y-2">
                  <Badge variant="secondary" className="text-xs">
                    Linked to deal
                  </Badge>
                  <p className="text-xs text-muted-foreground font-mono">{String(item.linked_deal_id)}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={handleViewDeal}
                      disabled={isResolvingDeal}
                    >
                      {isResolvingDeal ? 'Opening...' : 'View Deal'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 text-destructive"
                      onClick={handleUnlinkDeal}
                    >
                      Unlink
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowCreateDealDialog(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create Deal from Reply
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Manual re-classification */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Manual Override</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                <Select
                  value={String(item.manual_category || '')}
                  onValueChange={(v) => handleRecategorize('category', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Override category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">
                        {CATEGORY_LABELS[c] || c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Sentiment</label>
                <Select
                  value={String(item.manual_sentiment || '')}
                  onValueChange={(v) => handleRecategorize('sentiment', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Override sentiment" />
                  </SelectTrigger>
                  <SelectContent>
                    {SENTIMENTS.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Deal Dialog */}
      {item && (
        <CreateDealFromReplyDialog
          open={showCreateDealDialog}
          onOpenChange={setShowCreateDealDialog}
          inboxItem={item as unknown as Record<string, unknown>}
        />
      )}
    </div>
  );
}
