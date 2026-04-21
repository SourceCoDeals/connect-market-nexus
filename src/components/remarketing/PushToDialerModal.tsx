import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  usePhoneBurnerConnectedUsers,
  type PhoneBurnerConnectedUser,
} from '@/hooks/use-phoneburner-users';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ExternalLink, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import phoneburnerLogo from '@/assets/phoneburner-logo.svg';

type DialerEntityType =
  | 'contacts'
  | 'buyer_contacts'
  | 'buyers'
  | 'listings'
  | 'leads'
  | 'contact_list';

interface InlineContact {
  phone: string;
  name?: string;
  email?: string;
  company?: string;
  /** Optional attribution fields — round-trip via PhoneBurner custom fields */
  valuation_lead_id?: string;
  listing_id?: string;
  contact_id?: string;
}

interface PushToDialerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  contactCount: number;
  entityType?: DialerEntityType;
  inlineContacts?: InlineContact[];
}

interface PushResult {
  success: boolean;
  contacts_added: number;
  contacts_failed: number;
  contacts_excluded: number;
  exclusions?: { name: string; reason: string }[];
  errors?: string[];
  error?: string;
  redirect_url?: string;
}

function getInitials(label: string | null | undefined): string {
  if (!label) return '··';
  const cleaned = label.trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

function PhoneBurnerMark({ className }: { className?: string }) {
  return (
    <img
      src={phoneburnerLogo}
      alt=""
      aria-hidden
      className={cn('select-none', className)}
      draggable={false}
    />
  );
}

export function PushToDialerModal({
  open,
  onOpenChange,
  contactIds,
  contactCount,
  entityType = 'contacts',
  inlineContacts,
}: PushToDialerModalProps) {
  const isQuickDial = contactCount === 1 && (inlineContacts?.length ?? 0) > 0;
  const quickContact = isQuickDial ? inlineContacts![0] : undefined;

  const defaultSessionName = isQuickDial
    ? `Quick dial — ${quickContact?.name || quickContact?.phone || 'contact'}`
    : `Buyer Outreach — ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

  const [sessionName, setSessionName] = useState(defaultSessionName);
  const [skipRecentDays] = useState(7);
  const [skipRecent, setSkipRecent] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [quickAccount, setQuickAccount] = useState<string>('self'); // 'self' = caller's own PB account
  const [result, setResult] = useState<PushResult | null>(null);
  const [multiResults, setMultiResults] = useState<
    Array<{ user: PhoneBurnerConnectedUser; result: PushResult }>
  >([]);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const { data: connectedUsers = [], isLoading: usersLoading } = usePhoneBurnerConnectedUsers();
  const validUsers = useMemo(() => connectedUsers.filter((u) => !u.is_expired), [connectedUsers]);

  // Reset session name when the contact identity changes (different click target)
  useEffect(() => {
    if (open) {
      setSessionName(defaultSessionName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, quickContact?.phone, quickContact?.name]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const selectAllUsers = () => {
    if (selectedUserIds.length === validUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(validUsers.map((u) => u.user_id));
    }
  };

  const pushMutation = useMutation({
    mutationFn: async () => {
      setInlineError(null);

      // In quick-dial mode the user picks a single account from the dropdown
      // (defaulting to their own). In bulk mode we honour the multi-select.
      const targetUsers: (string | undefined)[] = isQuickDial
        ? [quickAccount === 'self' ? undefined : quickAccount]
        : selectedUserIds.length > 0
          ? selectedUserIds
          : [undefined];

      const results: Array<{
        user: PhoneBurnerConnectedUser | null;
        result: PushResult;
      }> = [];

      for (const targetUserId of targetUsers) {
        try {
          const { data, error } = await supabase.functions.invoke('phoneburner-push-contacts', {
            body: {
              entity_type: entityType,
              entity_ids: contactIds,
              session_name: sessionName,
              skip_recent_days: isQuickDial ? 0 : skipRecent ? skipRecentDays : 0,
              ...(inlineContacts && inlineContacts.length > 0
                ? { inline_contacts: inlineContacts }
                : {}),
              ...(targetUserId ? { target_user_id: targetUserId } : {}),
            },
          });

          if (error) {
            let errorMsg = error instanceof Error ? error.message : String(error);
            try {
              if ('context' in error && error.context instanceof Response) {
                const body = await error.context.json();
                if (body?.error) errorMsg = body.error;
              }
            } catch {
              // ignore parse errors
            }
            results.push({
              user: connectedUsers.find((u) => u.user_id === targetUserId) || null,
              result: {
                success: false,
                contacts_added: 0,
                contacts_failed: 0,
                contacts_excluded: 0,
                error: errorMsg,
              },
            });
          } else {
            results.push({
              user: connectedUsers.find((u) => u.user_id === targetUserId) || null,
              result: data as PushResult,
            });
          }
        } catch (err) {
          results.push({
            user: connectedUsers.find((u) => u.user_id === targetUserId) || null,
            result: {
              success: false,
              contacts_added: 0,
              contacts_failed: 0,
              contacts_excluded: 0,
              error: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      if (results.length === 1) {
        const r = results[0].result;
        setResult(r);
        if (r.success && r.contacts_added > 0) {
          if (r.redirect_url) window.open(r.redirect_url, '_blank');
          if (isQuickDial) {
            toast.success('Opening PhoneBurner dialer…');
            // Auto-close in quick-dial mode — the dialer tab is already open
            setTimeout(() => handleClose(), 2200);
          } else {
            toast.success(`${r.contacts_added} contacts pushed to PhoneBurner`);
          }
        } else if (r.error) {
          setInlineError(r.error);
        }
      } else {
        const totalAdded = results.reduce((sum, r) => sum + (r.result.contacts_added || 0), 0);
        const totalFailed = results.reduce((sum, r) => sum + (r.result.contacts_failed || 0), 0);
        setMultiResults(
          results.filter(
            (r): r is { user: PhoneBurnerConnectedUser; result: PushResult } => r.user !== null,
          ),
        );
        if (totalAdded > 0) {
          toast.success(
            `${totalAdded} contacts pushed across ${results.length} PhoneBurner accounts`,
          );
          const firstRedirect = results.find((r) => r.result.redirect_url)?.result.redirect_url;
          if (firstRedirect) window.open(firstRedirect, '_blank');
        }
        if (totalFailed > 0) toast.warning(`${totalFailed} contacts failed across accounts`);
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      const friendly = msg.includes('PB_NOT_CONNECTED')
        ? 'PhoneBurner is not connected for this account. Connect it in PhoneBurner Settings first.'
        : msg;
      setInlineError(friendly);
    },
  });

  const handleClose = () => {
    setResult(null);
    setMultiResults([]);
    setSelectedUserIds([]);
    setInlineError(null);
    onOpenChange(false);
  };

  const hasResults = result !== null || multiResults.length > 0;

  const canSubmit = isQuickDial
    ? // quick-dial: just needs a session name; account defaults to "self"
      !pushMutation.isPending && Boolean(sessionName.trim())
    : !pushMutation.isPending &&
      Boolean(sessionName.trim()) &&
      (validUsers.length === 0 || selectedUserIds.length > 0);

  const disabledHint =
    !isQuickDial && validUsers.length > 0 && selectedUserIds.length === 0
      ? 'Pick an account to enable'
      : !sessionName.trim()
        ? 'Add a session name to enable'
        : null;

  // Resolved primary phone for quick-dial display
  const quickPhoneLabel = quickContact?.phone || '';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[460px] gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 space-y-3 text-left">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-50 ring-1 ring-orange-100 flex items-center justify-center shrink-0">
              <PhoneBurnerMark className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-orange-700/80">
                PhoneBurner
              </p>
              <DialogTitle className="text-[17px] font-semibold leading-tight tracking-tight text-foreground">
                {isQuickDial ? 'Start dial session' : 'Push to dialer'}
              </DialogTitle>
            </div>
          </div>
          {!isQuickDial && (
            <DialogDescription className="text-xs text-muted-foreground">
              {contactCount} contacts &middot; ~{Math.round(contactCount * 2.5)} min estimated dial
              time
            </DialogDescription>
          )}
        </DialogHeader>

        {!hasResults ? (
          <>
            <div className="px-6 pb-2 space-y-5">
              {/* Quick-dial: contact identity card */}
              {isQuickDial && quickContact && (
                <div className="rounded-lg border border-border/70 bg-card px-4 py-3">
                  <p className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
                    Calling
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground truncate">
                    {quickContact.name || 'Unnamed contact'}
                  </p>
                  <p className="font-mono text-sm text-muted-foreground tracking-tight">
                    {quickPhoneLabel}
                  </p>
                  {quickContact.company && (
                    <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">
                      {quickContact.company}
                    </p>
                  )}
                </div>
              )}

              {/* Account picker — quick-dial = compact dropdown */}
              {isQuickDial ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
                    From account
                  </p>
                  {usersLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading accounts…
                    </div>
                  ) : (
                    <Select value={quickAccount} onValueChange={setQuickAccount}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Choose account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self">My PhoneBurner account</SelectItem>
                        {validUsers.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.label}
                            {user.phoneburner_user_email ? ` · ${user.phoneburner_user_email}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
                      From account
                    </p>
                    {validUsers.length > 1 && (
                      <button
                        type="button"
                        onClick={selectAllUsers}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {selectedUserIds.length === validUsers.length
                          ? 'Clear all'
                          : `Select all (${validUsers.length})`}
                      </button>
                    )}
                  </div>

                  {usersLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading accounts…
                    </div>
                  ) : validUsers.length === 0 ? (
                    <div className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                      No PhoneBurner accounts connected.{' '}
                      <a
                        href="/admin/phoneburner/settings"
                        className="underline underline-offset-2 font-medium text-foreground"
                      >
                        Connect one
                      </a>{' '}
                      to start a dial session.
                    </div>
                  ) : (
                    <div className="max-h-52 overflow-y-auto -mx-1 px-1 space-y-1.5">
                      {validUsers.map((user) => {
                        const selected = selectedUserIds.includes(user.user_id);
                        return (
                          <button
                            key={user.user_id}
                            type="button"
                            onClick={() => toggleUser(user.user_id)}
                            className={cn(
                              'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all',
                              selected
                                ? 'border-orange-300 bg-orange-50/60 ring-1 ring-orange-200'
                                : 'border-border/70 hover:border-border hover:bg-muted/40',
                            )}
                          >
                            <div
                              className={cn(
                                'h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 transition-colors',
                                selected
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {selected ? <Check className="h-4 w-4" /> : getInitials(user.label)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">
                                {user.label}
                              </p>
                              {user.phoneburner_user_email && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {user.phoneburner_user_email}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Session name + skip-recent — only in bulk mode */}
              {!isQuickDial && (
                <>
                  <div className="space-y-2">
                    <Label
                      htmlFor="session-name"
                      className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground"
                    >
                      Session name
                    </Label>
                    <Input
                      id="session-name"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder="e.g. PE Buyers — Feb 2026"
                      className="h-10"
                    />
                  </div>

                  <label
                    htmlFor="skip-recent"
                    className="flex items-start gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <Checkbox
                      id="skip-recent"
                      checked={skipRecent}
                      onCheckedChange={(v) => setSkipRecent(v === true)}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">Skip recently contacted</p>
                      <p className="text-xs text-muted-foreground">
                        Exclude contacts called in the last {skipRecentDays} days
                      </p>
                    </div>
                  </label>
                </>
              )}

              {/* Inline error */}
              {inlineError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-destructive/80">
                    Couldn&rsquo;t start dialer
                  </p>
                  <p className="text-sm text-destructive mt-0.5">{inlineError}</p>
                </div>
              )}
            </div>

            <DialogFooter className="px-6 py-4 mt-2 border-t border-border/60 bg-muted/20 flex-row sm:justify-between items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {disabledHint && !pushMutation.isPending ? disabledHint : '\u00A0'}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={handleClose}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => pushMutation.mutate()}
                  disabled={!canSubmit}
                  className="bg-orange-600 hover:bg-orange-700 text-white shadow-sm"
                >
                  {pushMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isQuickDial ? 'Connecting…' : 'Pushing…'}
                    </>
                  ) : isQuickDial ? (
                    <>
                      <PhoneBurnerMark className="h-4 w-4" />
                      Call {quickPhoneLabel || 'now'}
                    </>
                  ) : (
                    <>
                      <PhoneBurnerMark className="h-4 w-4" />
                      Start session
                      {selectedUserIds.length > 1 ? ` (${selectedUserIds.length} accounts)` : ''}
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : multiResults.length > 0 ? (
          <>
            <div className="px-6 pb-2 space-y-2">
              <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
                Push results
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {multiResults.map(({ user, result: r }) => {
                  const ok = r.success && r.contacts_added > 0;
                  return (
                    <div
                      key={user.user_id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full shrink-0',
                            ok ? 'bg-emerald-500' : 'bg-destructive',
                          )}
                        />
                        <span className="text-sm font-medium text-foreground truncate">
                          {user.label}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {ok
                          ? `${r.contacts_added} added${
                              r.contacts_excluded > 0 ? ` · ${r.contacts_excluded} excluded` : ''
                            }`
                          : r.error || '0 added'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter className="px-6 py-4 mt-2 border-t border-border/60 bg-muted/20">
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : result ? (
          <>
            <div className="px-6 pb-2 space-y-3">
              {result.success && result.contacts_added > 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex items-start gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-emerald-900">
                      {isQuickDial
                        ? 'Dialer is opening in a new tab…'
                        : `${result.contacts_added} contacts pushed successfully`}
                    </p>
                    {result.redirect_url && (
                      <a
                        href={result.redirect_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:text-emerald-900 underline underline-offset-2 mt-1"
                      >
                        Open dialer
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-destructive mt-1.5 shrink-0" />
                  <p className="text-sm font-medium text-destructive">
                    {result.error || 'No contacts were pushed'}
                  </p>
                </div>
              )}

              {result.contacts_excluded > 0 && result.exclusions && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {result.contacts_excluded} excluded
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {result.exclusions.map((e, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        &middot; {e.name} — {e.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {result.contacts_failed > 0 && result.errors && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive">
                    {result.contacts_failed} failed
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive/80">
                        &middot; {e}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="px-6 py-4 mt-2 border-t border-border/60 bg-muted/20">
              <Button onClick={handleClose} variant="outline">
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
