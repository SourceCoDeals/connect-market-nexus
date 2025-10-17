import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Clock, FileText, User, Calendar, Phone, Mail, AlertTriangle, Pencil, Trash2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Deal } from '@/hooks/admin/use-deals';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import { useUpdateDeal } from '@/hooks/admin/use-deals';
import { useUpdateLeadNDAStatus, useUpdateLeadFeeAgreementStatus } from '@/hooks/admin/requests/use-lead-status-updates';
import { useUpdateDealFollowup } from '@/hooks/admin/use-deal-followup';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCheck } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useDealComments, useCreateDealComment, useUpdateDealComment, useDeleteDealComment } from '@/hooks/admin/use-deal-comments';
import { useConnectionRequestDetails } from '@/hooks/admin/use-connection-request-details';
import { ConnectionRequestNotes } from '@/components/admin/pipeline/ConnectionRequestNotes';

interface PipelineDetailOverviewProps {
  deal: Deal;
}

export function PipelineDetailOverview({ deal }: PipelineDetailOverviewProps) {
  const { data: allAdminProfiles, isLoading: adminProfilesLoading } = useAdminProfiles();
  const assignedAdmin = deal.assigned_to && allAdminProfiles ? allAdminProfiles[deal.assigned_to] : null;
  const updateDeal = useUpdateDeal();
  const updateDealFollowup = useUpdateDealFollowup();
  
  // Fetch connection request details to show buyer message
  const { data: connectionRequestDetails } = useConnectionRequestDetails(deal.connection_request_id);
  
  const [followedUp, setFollowedUp] = React.useState(deal.followed_up || false);
  const [negativeFollowedUp, setNegativeFollowedUp] = React.useState(deal.negative_followed_up || false);
  const [otherDeals, setOtherDeals] = React.useState<any[]>([]);
  const [selectedOtherDeals, setSelectedOtherDeals] = React.useState<string[]>([]);
  
  // Comments state
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
  
  // Extract mentions from text (@username format)
  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = text.matchAll(mentionRegex);
    const mentionedNames = Array.from(matches, m => m[1]);
    
    if (!allAdminProfiles || mentionedNames.length === 0) return [];

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Map names to admin IDs by fuzzy matching displayName or email
    return Object.values(allAdminProfiles)
      .filter(admin => mentionedNames.some(name => {
        const n = normalize(name);
        const dn = normalize(admin.displayName || '');
        const em = normalize(admin.email || '');
        return dn.includes(n) || em.includes(n);
      }))
      .map(admin => admin.id);
  };
  
  // Filter admins for mention autocomplete
  const filteredAdmins = React.useMemo(() => {
    if (!allAdminProfiles || !mentionSearch) return [];
    const search = mentionSearch.toLowerCase();
    return Object.values(allAdminProfiles).filter(admin =>
      admin.displayName.toLowerCase().includes(search) ||
      admin.email.toLowerCase().includes(search)
    );
  }, [allAdminProfiles, mentionSearch]);
  
  // Handle @ key press
  const handleTextChange = (text: string) => {
    setNewCommentText(text);
    
    // Check if user typed @
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1 && lastAtSymbol === cursorPos - 1) {
      setShowMentionsList(true);
      setMentionSearch('');
    } else if (lastAtSymbol !== -1) {
      const searchTerm = textBeforeCursor.substring(lastAtSymbol + 1);
      if (searchTerm && !searchTerm.includes(' ')) {
        setShowMentionsList(true);
        setMentionSearch(searchTerm);
      } else {
        setShowMentionsList(false);
      }
    } else {
      setShowMentionsList(false);
    }
  };
  
  const insertMention = (admin: any) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = newCommentText.substring(0, cursorPos);
    const textAfterCursor = newCommentText.substring(cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    const newText = 
      textBeforeCursor.substring(0, lastAtSymbol) + 
      '@' + admin.displayName.replace(/\s/g, '') + ' ' +
      textAfterCursor;
    
    setNewCommentText(newText);
    setShowMentionsList(false);
    textareaRef.current?.focus();
  };
  
  // Fetch other deals from same buyer
  React.useEffect(() => {
    const fetchOtherDeals = async () => {
      if (!deal.connection_request_id || !deal.contact_email) return;

      const { data: allDeals } = await supabase
        .from('deals')
        .select('id, title, listing_title, listing_real_company_name, stage_id, followed_up, negative_followed_up')
        .eq('contact_email', deal.contact_email)
        .neq('id', deal.deal_id);

      setOtherDeals(allDeals || []);
    };

    fetchOtherDeals();
  }, [deal.deal_id, deal.connection_request_id, deal.contact_email]);
  
  // Sync local state
  React.useEffect(() => {
    setFollowedUp(deal.followed_up || false);
    setNegativeFollowedUp(deal.negative_followed_up || false);
  }, [deal.followed_up, deal.negative_followed_up]);

  // Date validation helper
  const isValidDate = (value?: string | null) => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return !isNaN(time);
  };

  const formatDateSafely = (value?: string | null) => {
    if (!isValidDate(value)) return 'N/A';
    try {
      return formatDistanceToNow(new Date(value!), { addSuffix: true });
    } catch (error) {
      return 'N/A';
    }
  };

  const handleOwnerChange = (value: string) => {
    const adminId = value === 'unassigned' ? null : value;
    updateDeal.mutate({
      dealId: deal.deal_id,
      updates: { assigned_to: adminId }
    });
  };

  // Use new hooks that update connection_requests
  const updateLeadNDA = useUpdateLeadNDAStatus();
  const updateLeadFeeAgreement = useUpdateLeadFeeAgreementStatus();

  const handleNDAToggle = (checked: boolean) => {
    if (!deal.connection_request_id) return;
    
    updateLeadNDA.mutate({
      requestId: deal.connection_request_id,
      value: checked
    });
  };

  const handleFeeAgreementToggle = (checked: boolean) => {
    if (!deal.connection_request_id) return;
    
    updateLeadFeeAgreement.mutate({
      requestId: deal.connection_request_id,
      value: checked
    });
  };
  
  const handleFollowupToggle = async (type: 'positive' | 'negative', newValue: boolean) => {
    if (type === 'positive') {
      setFollowedUp(newValue);
    } else {
      setNegativeFollowedUp(newValue);
    }

    // Get connection request IDs to update (current + selected others)
    const requestIdsToUpdate: string[] = [];
    
    if (deal.connection_request_id) {
      requestIdsToUpdate.push(deal.connection_request_id);
    }

    // Add selected other deals' connection requests
    const { data: selectedDealsData } = await supabase
      .from('deals')
      .select('connection_request_id')
      .in('id', selectedOtherDeals);

    if (selectedDealsData) {
      requestIdsToUpdate.push(...selectedDealsData
        .map(d => d.connection_request_id)
        .filter((id): id is string => !!id));
    }

    updateDealFollowup.mutate({
      dealId: deal.deal_id,
      connectionRequestIds: requestIdsToUpdate,
      isFollowedUp: newValue,
      followupType: type
    });
  };

  

  const getStatusInfo = (status?: string) => {
    switch (status) {
      case 'signed':
        return { icon: CheckCircle, label: 'Signed', color: 'text-emerald-600', bg: 'bg-emerald-50' };
      case 'sent':
        return { icon: Clock, label: 'Sent', color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'not_sent':
      default:
        return { icon: AlertTriangle, label: 'Not Sent', color: 'text-amber-600', bg: 'bg-amber-50' };
    }
  };

  const ndaStatus = getStatusInfo(deal.nda_status);
  const feeStatus = getStatusInfo(deal.fee_agreement_status);

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex gap-6 px-6 py-6">
        {/* Left Column - Main Content */}
        <div className="flex-1 space-y-6 max-w-3xl">
          {/* Deal Description */}
          {deal.deal_description && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {deal.deal_description}
              </p>
            </div>
          )}

          {/* Buyer Message */}
          {connectionRequestDetails && (
            <ConnectionRequestNotes details={connectionRequestDetails} />
          )}

          {/* Documents Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Documents</h3>
            
            <div className="grid grid-cols-2 gap-3">
              {/* NDA Card */}
              <div className="p-3 border border-border/40 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      deal.nda_status === 'signed' ? 'bg-emerald-500' :
                      deal.nda_status === 'sent' ? 'bg-amber-500' :
                      'bg-muted-foreground/30'
                    }`} />
                    <span className="text-sm font-medium text-foreground">NDA</span>
                  </div>
                  <Switch
                    checked={deal.nda_status === 'signed'}
                    onCheckedChange={handleNDAToggle}
                    disabled={updateLeadNDA.isPending || !deal.connection_request_id}
                    className="scale-75"
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {deal.nda_status === 'signed' ? 'Signed' :
                   deal.nda_status === 'sent' ? 'Sent' : 'Not Sent'}
                </span>
              </div>

              {/* Fee Agreement Card */}
              <div className="p-3 border border-border/40 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      deal.fee_agreement_status === 'signed' ? 'bg-emerald-500' :
                      deal.fee_agreement_status === 'sent' ? 'bg-amber-500' :
                      'bg-muted-foreground/30'
                    }`} />
                    <span className="text-sm font-medium text-foreground">Fee Agreement</span>
                  </div>
                  <Switch
                    checked={deal.fee_agreement_status === 'signed'}
                    onCheckedChange={handleFeeAgreementToggle}
                    disabled={updateLeadFeeAgreement.isPending || !deal.connection_request_id}
                    className="scale-75"
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {deal.fee_agreement_status === 'signed' ? 'Signed' :
                   deal.fee_agreement_status === 'sent' ? 'Sent' : 'Not Sent'}
                </span>
              </div>
            </div>
          </div>

          {/* Follow-up Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Follow-up</h3>
            
            <div className="space-y-2">
              {/* Positive Follow-up */}
              <div className="p-3 border border-border/40 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="positive-followup-overview" className="text-sm font-medium cursor-pointer">
                      Positive Follow-up
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ready for owner introduction
                    </p>
                  </div>
                  <Switch
                    id="positive-followup-overview"
                    checked={followedUp}
                    onCheckedChange={(checked) => handleFollowupToggle('positive', checked)}
                    className="scale-75"
                  />
                </div>
                {followedUp && deal.followed_up_at && (
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    {formatDateSafely(deal.followed_up_at)}
                    {deal.followed_up_by && allAdminProfiles?.[deal.followed_up_by] && (
                      <span className="ml-1">by {allAdminProfiles[deal.followed_up_by].displayName}</span>
                    )}
                  </p>
                )}
              </div>

              {/* Rejection Notice */}
              <div className="p-3 border border-border/40 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="negative-followup-overview" className="text-sm font-medium cursor-pointer">
                      Rejection Notice
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Send rejection to buyer
                    </p>
                  </div>
                  <Switch
                    id="negative-followup-overview"
                    checked={negativeFollowedUp}
                    onCheckedChange={(checked) => handleFollowupToggle('negative', checked)}
                    className="scale-75"
                  />
                </div>
                {negativeFollowedUp && deal.negative_followed_up_at && (
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    {formatDateSafely(deal.negative_followed_up_at)}
                    {deal.negative_followed_up_by && allAdminProfiles?.[deal.negative_followed_up_by] && (
                      <span className="ml-1">by {allAdminProfiles[deal.negative_followed_up_by].displayName}</span>
                    )}
                  </p>
                )}
              </div>
            </div>
              
            {otherDeals.length > 0 && (
              <div className="p-3 border border-border/40 rounded-lg">
                <Label className="text-xs text-muted-foreground">
                  Also update for {deal.contact_name || deal.contact_email}:
                </Label>
                <div className="space-y-1.5 mt-2">
                  {otherDeals.map((otherDeal) => (
                    <div key={otherDeal.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`deal-overview-${otherDeal.id}`}
                        checked={selectedOtherDeals.includes(otherDeal.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedOtherDeals([...selectedOtherDeals, otherDeal.id]);
                          } else {
                            setSelectedOtherDeals(selectedOtherDeals.filter(id => id !== otherDeal.id));
                          }
                        }}
                      />
                      <label
                        htmlFor={`deal-overview-${otherDeal.id}`}
                        className="text-xs text-foreground cursor-pointer flex items-center gap-2"
                      >
                        {otherDeal.listing_real_company_name || otherDeal.listing_title || otherDeal.title}
                        {otherDeal.followed_up && (
                          <Badge variant="outline" className="text-xs">
                            <CheckCheck className="h-2.5 w-2.5 mr-1" />
                            Followed
                          </Badge>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Comments</h3>
              <span className="text-xs text-muted-foreground font-mono">
                {dealComments?.length || 0}
              </span>
            </div>

            {/* New Comment Input */}
            <div className="space-y-2 relative">
              <Textarea
                ref={textareaRef}
                placeholder="Write a comment... (use @ to mention)"
                value={newCommentText}
                onChange={(e) => handleTextChange(e.target.value)}
                className="min-h-[80px] resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && newCommentText.trim()) {
                    const mentions = extractMentions(newCommentText);
                    createComment.mutate(
                      { 
                        dealId: deal.deal_id, 
                        commentText: newCommentText.trim(),
                        mentionedAdmins: mentions,
                      },
                      { onSuccess: () => setNewCommentText('') }
                    );
                  }
                }}
              />
              
              {/* Mentions dropdown */}
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
                <span className="text-xs text-muted-foreground">
                  Cmd/Ctrl + Enter to send
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    if (newCommentText.trim()) {
                      const mentions = extractMentions(newCommentText);
                      createComment.mutate(
                        { 
                          dealId: deal.deal_id, 
                          commentText: newCommentText.trim(),
                          mentionedAdmins: mentions,
                        },
                        { onSuccess: () => setNewCommentText('') }
                      );
                    }
                  }}
                  disabled={!newCommentText.trim() || createComment.isPending}
                  className="h-7 text-xs"
                >
                  Add Comment
                </Button>
              </div>
            </div>

            {/* Comments List */}
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
                  <div
                    key={comment.id}
                    className="group p-3 border border-border/40 rounded-lg hover:border-border/60 transition-colors"
                  >
                    {editingCommentId === comment.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          className="min-h-[60px] resize-none text-sm"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (editingCommentText.trim()) {
                                const mentions = extractMentions(editingCommentText);
                                updateComment.mutate(
                                  {
                                    commentId: comment.id,
                                    commentText: editingCommentText.trim(),
                                    mentionedAdmins: mentions,
                                    dealId: deal.deal_id,
                                  },
                                  {
                                    onSuccess: () => {
                                      setEditingCommentId(null);
                                      setEditingCommentText('');
                                    },
                                  }
                                );
                              }
                            }}
                            disabled={!editingCommentText.trim() || updateComment.isPending}
                            className="h-6 text-xs"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditingCommentText('');
                            }}
                            className="h-6 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-foreground whitespace-pre-wrap mb-2">
                          {comment.comment_text.split(/(@\w+)/g).map((part, i) => {
                            if (part.startsWith('@')) {
                              return (
                                <span key={i} className="text-primary font-medium">
                                  {part}
                                </span>
                              );
                            }
                            return part;
                          })}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium">{comment.admin_name}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                            {comment.updated_at !== comment.created_at && (
                              <>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="italic">edited</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingCommentText(comment.comment_text);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm('Delete this comment?')) {
                                  deleteComment.mutate({ commentId: comment.id, dealId: deal.deal_id });
                                }
                              }}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
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
                <p className="text-sm text-muted-foreground">No comments here yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Metadata */}
        <div className="w-80 flex-shrink-0 space-y-6">
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
                  <SelectItem key={admin.id} value={admin.id}>
                    {admin.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-px bg-border" />

          {/* Buyer Info */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Contact</Label>
              <p className="text-sm text-foreground font-medium">{deal.contact_name || 'Unknown'}</p>
            </div>

            {deal.contact_company && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Company</Label>
                <p className="text-sm text-foreground">{deal.contact_company}</p>
              </div>
            )}

            {deal.contact_email && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
                <p className="text-sm text-foreground font-mono">{deal.contact_email}</p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Buyer Type</Label>
              <p className="text-sm text-foreground">
                {(() => {
                  switch (deal.buyer_type) {
                    case 'privateEquity': return 'Private Equity';
                    case 'familyOffice': return 'Family Office';
                    case 'searchFund': return 'Search Fund';
                    case 'corporate': return 'Corporate';
                    case 'individual': return 'Individual';
                    case 'independentSponsor': return 'Independent Sponsor';
                    default: return 'Unknown';
                  }
                })()}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Priority Score</Label>
              <p className="text-sm text-foreground font-mono">{deal.buyer_priority_score || 0}</p>
            </div>
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

          {/* Task Summary */}
          {deal.total_tasks > 0 && (
            <>
              <div className="h-px bg-border" />
              
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tasks</Label>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-foreground font-medium">{deal.total_tasks}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pending</span>
                    <span className="text-amber-600 font-medium">{deal.pending_tasks}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Done</span>
                    <span className="text-emerald-600 font-medium">{deal.completed_tasks}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Action Required */}
          {(!deal.followed_up || deal.pending_tasks > 0) && (
            <>
              <div className="h-px bg-border" />
              
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Action Required</Label>
                <div className="space-y-1.5">
                  {!deal.followed_up && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-amber-700">Follow-up pending</span>
                    </div>
                  )}
                  {deal.pending_tasks > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span className="text-blue-700">{deal.pending_tasks} task{deal.pending_tasks > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}