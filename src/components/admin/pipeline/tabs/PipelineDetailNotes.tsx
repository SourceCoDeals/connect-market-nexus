import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Deal } from '@/hooks/admin/use-deals';
import { useAdminProfiles } from '@/hooks/admin/use-admin-profiles';
import {
  useDealComments,
  useCreateDealComment,
  useUpdateDealComment,
  useDeleteDealComment,
} from '@/hooks/admin/use-deal-comments';

interface PipelineDetailNotesProps {
  deal: Deal;
}

export function PipelineDetailNotes({ deal }: PipelineDetailNotesProps) {
  const { data: allAdminProfiles } = useAdminProfiles();
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
    const mentionedNames = Array.from(matches, (m) => m[1]);
    if (!allAdminProfiles || mentionedNames.length === 0) return [];
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return Object.values(allAdminProfiles)
      .filter((admin) =>
        mentionedNames.some((name) => {
          const n = normalize(name);
          return (
            normalize(admin.displayName || '').includes(n) ||
            normalize(admin.email || '').includes(n)
          );
        }),
      )
      .map((admin) => admin.id);
  };

  const filteredAdmins = React.useMemo(() => {
    if (!allAdminProfiles || !mentionSearch) return [];
    const search = mentionSearch.toLowerCase();
    return Object.values(allAdminProfiles).filter(
      (admin) =>
        admin.displayName.toLowerCase().includes(search) ||
        admin.email.toLowerCase().includes(search),
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

  const insertMention = (admin: { displayName: string }) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const before = newCommentText.substring(0, cursorPos);
    const after = newCommentText.substring(cursorPos);
    const lastAt = before.lastIndexOf('@');
    setNewCommentText(
      before.substring(0, lastAt) + '@' + admin.displayName.replace(/\s/g, '') + ' ' + after,
    );
    setShowMentionsList(false);
    textareaRef.current?.focus();
  };

  const handleSubmit = () => {
    if (newCommentText.trim()) {
      const mentions = extractMentions(newCommentText);
      createComment.mutate(
        { dealId: deal.deal_id, commentText: newCommentText.trim(), mentionedAdmins: mentions },
        { onSuccess: () => setNewCommentText('') },
      );
    }
  };

  return (
    <div className="flex-1 overflow-auto px-6 py-6">
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Notes</h3>
          <span className="text-xs text-muted-foreground font-mono">
            {dealComments?.length || 0}
          </span>
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
                handleSubmit();
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
              onClick={handleSubmit}
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
                            updateComment.mutate(
                              {
                                commentId: comment.id,
                                commentText: editingCommentText.trim(),
                                mentionedAdmins: extractMentions(editingCommentText),
                                dealId: deal.deal_id,
                              },
                              {
                                onSuccess: () => {
                                  setEditingCommentId(null);
                                  setEditingCommentText('');
                                },
                              },
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
                      {comment.comment_text.split(/(@\w+)/g).map((part: string, i: number) => {
                        if (part.startsWith('@'))
                          return (
                            <span key={i} className="text-primary font-medium">
                              {part}
                            </span>
                          );
                        return part;
                      })}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">{comment.admin_name}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span>
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
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
                            if (confirm('Delete this note?'))
                              deleteComment.mutate({ commentId: comment.id, dealId: deal.deal_id });
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
            <p className="text-sm text-muted-foreground">No notes yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
