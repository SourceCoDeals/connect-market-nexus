import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Mail,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  Search,
  ExternalLink,
  Inbox,
  CheckSquare,
  Archive,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  useSmartleadInbox,
  useSmartleadInboxRealtime,
  useUpdateInboxStatus,
  type InboxFilter,
  type SmartleadInboxItem,
} from '@/hooks/smartlead/use-smartlead-inbox';
import { DraftReplyDialog } from '@/components/admin/smartlead/DraftReplyDialog';
import { MessageSquareReply } from 'lucide-react';

const CATEGORY_CONFIG: Record<string, { emoji: string; label: string }> = {
  meeting_request: { emoji: '📅', label: 'Meeting' },
  interested: { emoji: '✨', label: 'Interested' },
  question: { emoji: '❓', label: 'Question' },
  referral: { emoji: '👤', label: 'Referral' },
  not_now: { emoji: '⏰', label: 'Not Now' },
  not_interested: { emoji: '👎', label: 'Not Interested' },
  unsubscribe: { emoji: '🚫', label: 'Unsubscribe' },
  out_of_office: { emoji: '🏖️', label: 'OOO' },
  negative_hostile: { emoji: '⚠️', label: 'Hostile' },
  neutral: { emoji: '➖', label: 'Neutral' },
};

function getSentimentColor(sentiment: string | null) {
  if (sentiment === 'positive') return 'bg-green-500/10 text-green-700 dark:text-green-400';
  if (sentiment === 'activated') return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
  if (sentiment === 'negative') return 'bg-destructive/10 text-destructive';
  return 'bg-muted text-muted-foreground';
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function BuyerOutreachInbox() {
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draftReplyItem, setDraftReplyItem] = useState<SmartleadInboxItem | null>(null);
  const navigate = useNavigate();

  const { items, stats, isLoading, refetch } = useSmartleadInbox(filter, search, 'gp_buyer');
  useSmartleadInboxRealtime();
  const updateStatus = useUpdateInboxStatus();

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const handleBulkStatus = async (status: string) => {
    if (selected.size === 0) return;
    try {
      await updateStatus.mutateAsync({ ids: Array.from(selected), status });
      toast.success(`Marked ${selected.size} items as ${status}`);
      setSelected(new Set());
    } catch {
      toast.error('Failed to update status');
    }
  };

  const getDisplayName = (item: SmartleadInboxItem) => {
    if (item.lead_first_name || item.lead_last_name) {
      return [item.lead_first_name, item.lead_last_name].filter(Boolean).join(' ');
    }
    return item.to_name || item.sl_lead_email || item.from_email || 'Unknown';
  };

  const getCategory = (item: SmartleadInboxItem) => item.manual_category || item.ai_category;
  const getSentiment = (item: SmartleadInboxItem) => item.manual_sentiment || item.ai_sentiment;

  const filterButtons: { key: InboxFilter; label: string; icon: React.ReactNode; count: number }[] =
    [
      { key: 'all', label: 'All', icon: <Inbox className="h-3.5 w-3.5" />, count: stats.total },
      {
        key: 'meeting_request',
        label: 'Meetings',
        icon: <Calendar className="h-3.5 w-3.5" />,
        count: stats.meetings,
      },
      {
        key: 'interested',
        label: 'Interested',
        icon: <Sparkles className="h-3.5 w-3.5" />,
        count: stats.interested,
      },
      {
        key: 'positive',
        label: 'Positive',
        icon: <ThumbsUp className="h-3.5 w-3.5" />,
        count: stats.positive,
      },
      {
        key: 'negative',
        label: 'Negative',
        icon: <ThumbsDown className="h-3.5 w-3.5" />,
        count: stats.negative,
      },
      {
        key: 'neutral',
        label: 'Neutral',
        icon: <MinusCircle className="h-3.5 w-3.5" />,
        count: stats.neutral,
      },
    ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Buyer Outreach Inbox</h2>
          <p className="text-sm text-muted-foreground">
            Responses from GP Buyer outreach campaigns
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {filterButtons.map((fb) => (
          <Button
            key={fb.key}
            variant={filter === fb.key ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => setFilter(fb.key)}
          >
            {fb.icon}
            {fb.label}
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-xs">
              {fb.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, campaign, subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => handleBulkStatus('reviewed')}
          >
            <CheckSquare className="h-3.5 w-3.5" /> Mark Reviewed
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => handleBulkStatus('archived')}
          >
            <Archive className="h-3.5 w-3.5" /> Archive
          </Button>
        </div>
      )}

      {/* Items list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Mail className="mx-auto mb-2 h-8 w-8" />
              <p>No buyer outreach responses found</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b px-4 py-2">
                <Checkbox
                  checked={selected.size === items.length && items.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-xs text-muted-foreground">Select all</span>
              </div>
              <ScrollArea className="h-[600px]">
                {items.map((item) => {
                  const category = getCategory(item);
                  const sentiment = getSentiment(item);
                  const catConfig = CATEGORY_CONFIG[category || ''];
                  const preview =
                    item.preview_text ||
                    (item.reply_body
                      ? stripHtml(item.reply_body)
                      : item.reply_message
                        ? stripHtml(item.reply_message)
                        : '');

                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 border-b px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer ${
                        item.status === 'new' ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => navigate(`/admin/marketplace/messages/smartlead/${item.id}`)}
                    >
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{getDisplayName(item)}</span>
                          {item.lead_company_name && (
                            <span className="text-xs text-muted-foreground truncate">
                              @ {item.lead_company_name}
                            </span>
                          )}
                          {item.status === 'new' && (
                            <Badge variant="default" className="h-4 px-1 text-[10px]">
                              NEW
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {catConfig && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                              {catConfig.emoji} {catConfig.label}
                            </Badge>
                          )}
                          {sentiment && (
                            <Badge
                              className={`text-[10px] h-4 px-1 ${getSentimentColor(sentiment)}`}
                            >
                              {sentiment}
                            </Badge>
                          )}
                          {item.campaign_name && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                              {item.campaign_name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {preview || item.subject || '(No preview)'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {item.time_replied
                            ? formatDistanceToNow(new Date(item.time_replied), { addSuffix: true })
                            : ''}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDraftReplyItem(item);
                            }}
                            title="Draft reply"
                          >
                            <MessageSquareReply className="h-3.5 w-3.5" />
                          </Button>
                          {item.ui_master_inbox_link && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(item.ui_master_inbox_link!, '_blank');
                              }}
                              title="Open in Smartlead"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>

      {draftReplyItem && (
        <DraftReplyDialog
          inboxItemId={draftReplyItem.id}
          leadName={getDisplayName(draftReplyItem)}
          category={getCategory(draftReplyItem) || undefined}
          open={!!draftReplyItem}
          onOpenChange={(open) => {
            if (!open) setDraftReplyItem(null);
          }}
        />
      )}
    </div>
  );
}
