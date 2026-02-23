import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, MessageSquare, ExternalLink, Linkedin, Building2, Globe, Mail, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Deal } from '@/hooks/admin/use-deals';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { useUpdateDeal } from '@/hooks/admin/use-deals';
import { useUpdateDealFollowup } from '@/hooks/admin/use-deal-followup';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useDealComments, useCreateDealComment, useUpdateDealComment, useDeleteDealComment } from '@/hooks/admin/use-deal-comments';
import { useConnectionRequestDetails } from '@/hooks/admin/use-connection-request-details';

interface PipelineDetailOverviewProps {
  deal: Deal;
  onSwitchTab?: (tab: string) => void;
}

export function PipelineDetailOverview({ deal }: PipelineDetailOverviewProps) {
  const { data: allAdminProfiles, isLoading: adminProfilesLoading } = useAdminProfiles();
  const updateDeal = useUpdateDeal();
  const updateDealFollowup = useUpdateDealFollowup();
  const { data: connectionRequestDetails } = useConnectionRequestDetails(deal.connection_request_id);

  const [followedUp, setFollowedUp] = React.useState(deal.followed_up || false);
  const [negativeFollowedUp, setNegativeFollowedUp] = React.useState(deal.negative_followed_up || false);
  const [buyerProfile, setBuyerProfile] = React.useState<any>(null);

  // Comments
  const { data: dealComments, isLoading: commentsLoading } = useDealComments(deal.deal_id);
  const createComment = useCreateDealComment();
  const updateComment = useUpdateDealComment();
  const deleteComment = useDeleteDealComment();
  const [newCommentText, setNewCommentText] = React.useState('');
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = React.useState('');
  const [showMentionsList, setShowMentionsList] = React.useState(false);
  const [mentionSearch, setMentionSearch] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = text.matchAll(mentionRegex);
    const mentionedNames = Array.from(matches, m => m[1]);
    if (!allAdminProfiles || mentionedNames.length === 0) return [];
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return Object.values(allAdminProfiles)
      .filter(admin => mentionedNames.some(name => {
        const n = normalize(name);
        return normalize(admin.displayName || '').includes(n) || normalize(admin.email || '').includes(n);
      }))
      .map(admin => admin.id);
  };

  const filteredAdmins = React.useMemo(() => {
    if (!allAdminProfiles || !mentionSearch) return [];
    const search = mentionSearch.toLowerCase();
    return Object.values(allAdminProfiles).filter(admin =>
      admin.displayName.toLowerCase().includes(search) || admin.email.toLowerCase().includes(search)
    );
  }, [allAdminProfiles, mentionSearch]);

  const handleTextChange = (text: string) => {
    setNewCommentText(text);
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt !== -1 && lastAt === cursorPos - 1) {
      setShowMentionsList(true);
      setMentionSearch('');
    } else if (lastAt !== -1) {
      const term = textBeforeCursor.substring(lastAt + 1);
      if (term && !term.includes(' ')) {
        setShowMentionsList(true);
        setMentionSearch(term);
      } else setShowMentionsList(false);
    } else setShowMentionsList(false);
  };

  const insertMention = (admin: any) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const before = newCommentText.substring(0, cursorPos);
    const after = newCommentText.substring(cursorPos);
    const lastAt = before.lastIndexOf('@');
    setNewCommentText(before.substring(0, lastAt) + '@' + admin.displayName.replace(/\s/g, '') + ' ' + after);
    setShowMentionsList(false);
    textareaRef.current?.focus();
  };

  // Fetch buyer profile if we have a connection request
  React.useEffect(() => {
    const fetchProfile = async () => {
      if (!connectionRequestDetails?.user_id) return;
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, company, phone, buyer_type, linkedin_url, website')
        .eq('id', connectionRequestDetails.user_id)
        .maybeSingle();
      setBuyerProfile(data);
    };
    fetchProfile();
  }, [connectionRequestDetails?.user_id]);

  React.useEffect(() => {
    setFollowedUp(deal.followed_up || false);
    setNegativeFollowedUp(deal.negative_followed_up || false);
  }, [deal.followed_up, deal.negative_followed_up]);

  const isValidDate = (value?: string | null) => {
    if (!value) return false;
    return !isNaN(new Date(value!).getTime());
  };

  const formatDateSafely = (value?: string | null) => {
    if (!isValidDate(value)) return 'N/A';
    try { return formatDistanceToNow(new Date(value!), { addSuffix: true }); } catch { return 'N/A'; }
  };

  const handleOwnerChange = (value: string) => {
    updateDeal.mutate({ dealId: deal.deal_id, updates: { assigned_to: value === 'unassigned' ? null : value } });
  };

  const handleFollowupToggle = async (type: 'positive' | 'negative', newValue: boolean) => {
    if (type === 'positive') setFollowedUp(newValue);
    else setNegativeFollowedUp(newValue);

    const requestIds: string[] = [];
    if (deal.connection_request_id) requestIds.push(deal.connection_request_id);

    updateDealFollowup.mutate({
      dealId: deal.deal_id,
      connectionRequestIds: requestIds,
      isFollowedUp: newValue,
      followupType: type,
    });
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex gap-6 px-6 py-6">
        {/* Left Column */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Interest Expression */}
          {connectionRequestDetails?.user_message && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Interest Expression</h3>
              <div className="p-4 bg-muted/10 rounded-lg border border-border/20">
                <p className="text-sm text-foreground whitespace-pre-wrap">{connectionRequestDetails.user_message}</p>
              </div>
              {connectionRequestDetails.decision_notes && (
                <div className="p-3 bg-muted/5 rounded-lg border border-border/10">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Admin Notes</p>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{connectionRequestDetails.decision_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* General Notes / Comments */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Notes</h3>
              <span className="text-xs text-muted-foreground font-mono">{dealComments?.length || 0}</span>
            </div>

            <div className="space-y-2 relative">
              <Textarea
                ref={textareaRef}
                placeholder="Write a note... (use @ to mention)"
                value={newCommentText}
                onChange={(e) => handleTextChange(e.target.value)}
                className="min-h-[70px] resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && newCommentText.trim()) {
                    const mentions = extractMentions(newCommentText);
                    createComment.mutate(
                      { dealId: deal.deal_id, commentText: newCommentText.trim(), mentionedAdmins: mentions },
                      { onSuccess: () => setNewCommentText('') }
                    );
                  }
                }}
              />
              {showMentionsList && filteredAdmins.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {filteredAdmins.slice(0, 5).map((admin) => (
                    <button
                      key={admin.id}
                      onClick={() => insertMention(admin)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                    >
                      <span className="font-medium">{admin.displayName}</span>
                      <span className="text-xs text-muted-foreground">{admin.email}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Cmd/Ctrl + Enter to send</span>
                <Button
                  size="sm"
                  onClick={() => {
                    if (newCommentText.trim()) {
                      const mentions = extractMentions(newCommentText);
                      createComment.mutate(
                        { dealId: deal.deal_id, commentText: newCommentText.trim(), mentionedAdmins: mentions },
                        { onSuccess: () => setNewCommentText('') }
                      );
                    }
                  }}
                  disabled={!newCommentText.trim() || createComment.isPending}
                  className="h-7 text-xs"
                >
                  Add Note
                </Button>
              </div>
            </div>

            {commentsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="p-3 border border-border/40 rounded-lg animate-pulse">
                    <div className="h-4 bg-muted/50 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted/30 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : dealComments && dealComments.length > 0 ? (
              <div className="space-y-2">
                {dealComments.map((comment) => (
                  <div key={comment.id} className="group p-3 border border-border/40 rounded-lg hover:border-border/60 transition-colors">
                    {editingCommentId === comment.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          className="min-h-[60px] resize-none text-sm"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => {
                            if (editingCommentText.trim()) {
                              updateComment.mutate(
                                { commentId: comment.id, commentText: editingCommentText.trim(), mentionedAdmins: extractMentions(editingCommentText), dealId: deal.deal_id },
                                { onSuccess: () => { setEditingCommentId(null); setEditingCommentText(''); } }
                              );
                            }
                          }} disabled={!editingCommentText.trim() || updateComment.isPending} className="h-6 text-xs">Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingCommentId(null); setEditingCommentText(''); }} className="h-6 text-xs">Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-foreground whitespace-pre-wrap mb-2">
                          {comment.comment_text.split(/(@\w+)/g).map((part: string, i: number) => {
                            if (part.startsWith('@')) return <span key={i} className="text-primary font-medium">{part}</span>;
                            return part;
                          })}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium">{comment.admin_name}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                            {comment.updated_at !== comment.created_at && (
                              <><span className="text-muted-foreground/40">·</span><span className="italic">edited</span></>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.comment_text); }} className="h-6 w-6 p-0"><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => { if (confirm('Delete this note?')) deleteComment.mutate({ commentId: comment.id, dealId: deal.deal_id }); }} className="h-6 w-6 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-border/40 rounded-lg">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notes yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-72 flex-shrink-0 space-y-5">
          {/* Deal Owner */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Owner</Label>
            <Select
              value={deal.assigned_to || 'unassigned'}
              onValueChange={handleOwnerChange}
              disabled={adminProfilesLoading || updateDeal.isPending}
            >
              <SelectTrigger className="w-full h-8 text-sm">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {allAdminProfiles && Object.values(allAdminProfiles).map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>{admin.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-px bg-border" />

          {/* Contact Info */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Contact</Label>
            <p className="text-sm text-foreground font-medium">{deal.contact_name || 'Unknown'}</p>

            {(buyerProfile?.linkedin_url || deal.contact_email) && (
              <div className="space-y-1.5">
                {buyerProfile?.linkedin_url && (
                  <a href={buyerProfile.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <Linkedin className="w-3 h-3" />
                    LinkedIn
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {deal.contact_email && (
                  <a href={`mailto:${deal.contact_email}`} className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground">
                    <Mail className="w-3 h-3 text-muted-foreground" />
                    <span className="font-mono truncate">{deal.contact_email}</span>
                  </a>
                )}
                {(deal.contact_phone || buyerProfile?.phone) && (
                  <a href={`tel:${deal.contact_phone || buyerProfile?.phone}`} className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    <span>{deal.contact_phone || buyerProfile?.phone}</span>
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-border" />

          {/* Company */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Company</Label>
            {deal.contact_company && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-muted-foreground" />
                <span className="text-sm text-foreground">{deal.contact_company}</span>
              </div>
            )}
            {buyerProfile?.website && (
              <a href={buyerProfile.website.startsWith('http') ? buyerProfile.website : `https://${buyerProfile.website}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Globe className="w-3 h-3" />
                Website
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {buyerProfile?.buyer_type && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Type</Label>
                <p className="text-sm text-foreground">{buyerProfile.buyer_type}</p>
              </div>
            )}
          </div>

          <div className="h-px bg-border" />

          {/* Deal Metadata */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Stage Duration</Label>
              <p className="text-sm text-foreground">{formatDateSafely(deal.deal_stage_entered_at)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Deal Age</Label>
              <p className="text-sm text-foreground">{formatDateSafely(deal.deal_created_at)}</p>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Follow-up Toggles */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Follow-up</Label>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground">Positive</span>
              <Switch checked={followedUp} onCheckedChange={(v) => handleFollowupToggle('positive', v)} className="scale-75" />
            </div>
            {followedUp && deal.followed_up_at && (
              <p className="text-[10px] text-muted-foreground">
                {formatDateSafely(deal.followed_up_at)}
                {deal.followed_up_by && allAdminProfiles?.[deal.followed_up_by] && ` by ${allAdminProfiles[deal.followed_up_by].displayName}`}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground">Rejection</span>
              <Switch checked={negativeFollowedUp} onCheckedChange={(v) => handleFollowupToggle('negative', v)} className="scale-75" />
            </div>
            {negativeFollowedUp && deal.negative_followed_up_at && (
              <p className="text-[10px] text-muted-foreground">
                {formatDateSafely(deal.negative_followed_up_at)}
                {deal.negative_followed_up_by && allAdminProfiles?.[deal.negative_followed_up_by] && ` by ${allAdminProfiles[deal.negative_followed_up_by].displayName}`}
              </p>
            )}
          </div>

          {deal.deal_score != null && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Deal Score</Label>
                <p className="text-sm text-foreground font-mono">{deal.deal_score}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
