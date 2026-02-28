/**
 * ActionHub — Consolidated "Action Required" bar across ALL deals.
 *
 * Sits at the top of the My Deals page and aggregates every pending action
 * the buyer needs to take.  Actions are rendered as compact "chips" that
 * pair the action label with the deal name it belongs to, so buyers can
 * scan their full pipeline in one glance.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  ⚡  3 Actions Required Across Your Deals                       │
 * │     Complete these steps to keep your pipeline moving            │
 * │                                                                  │
 * │  [✍️ Sign NDA — Multi Division Collision →]                     │
 * │  [✍️ Sign Fee Agreement — Texas Fire Sprinkler →]               │
 * │  [💬 2 unread — Wealth Advisors →]                              │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * Design decisions:
 *
 *   • **Navy background** — Matches the institutional tone of an M&A
 *     portal.  The dark surface makes the gold-accented deal names pop
 *     and separates this bar from the lighter cream page background.
 *
 *   • **Chip layout** — Each action is a self-contained clickable chip
 *     (not a list row).  This is denser than the previous list layout
 *     and lets buyers process 3–5 actions without scrolling.
 *
 *   • **Priority ordering** — NDA first (blocks all deal access), fee
 *     agreement second (blocks CIM), unread messages third (important
 *     but not blocking).
 *
 *   • **Signing modal** — The component owns an AgreementSigningModal
 *     so NDA/fee actions can be completed inline without navigating
 *     away from the page.
 *
 * Action types gathered:
 *   1. sign_nda   — NDA is ready but unsigned (global, affects all deals)
 *   2. sign_fee   — Fee Agreement sent but unsigned (global)
 *   3. unread_messages — Per-deal unread message counts
 */

import { useState } from 'react';
import { FileSignature, Shield, MessageSquare, Zap, ArrowRight } from 'lucide-react';
import { useMyAgreementStatus } from '@/hooks/use-agreement-status';
import { useBuyerNdaStatus } from '@/hooks/admin/use-docuseal';
import { useAuth } from '@/context/AuthContext';
import { AgreementSigningModal } from '@/components/docuseal/AgreementSigningModal';
import type { ConnectionRequest } from '@/types';

/* ─── Types ────────────────────────────────────────────────────────────── */

interface ActionHubProps {
  requests: ConnectionRequest[];
  unreadByRequest: Record<string, number>;
  unreadMsgCounts?: { byRequest: Record<string, number> };
  onSelectDeal: (dealId: string, tab?: string) => void;
}

interface ActionItem {
  id: string;
  dealId: string;
  dealName: string;
  type: 'sign_nda' | 'sign_fee' | 'unread_messages';
  label: string;
  priority: number;
  icon: typeof Shield;
}

/* ─── Component ────────────────────────────────────────────────────────── */

export function ActionHub({
  requests,
  unreadByRequest: _unreadByRequest,
  unreadMsgCounts,
  onSelectDeal,
}: ActionHubProps) {
  const { user, isAdmin } = useAuth();
  const { data: ndaStatus } = useBuyerNdaStatus(!isAdmin ? user?.id : undefined);
  const { data: coverage } = useMyAgreementStatus(!isAdmin && !!user);
  const [signingOpen, setSigningOpen] = useState(false);
  const [signingType, setSigningType] = useState<'nda' | 'fee_agreement'>('nda');

  /* ── Gather pending actions ── */

  const actions: ActionItem[] = [];

  // 1. NDA signing — global, not per-deal
  const needsNda = ndaStatus?.hasFirm && !ndaStatus.ndaSigned && ndaStatus.hasSubmission;
  if (needsNda) {
    actions.push({
      id: 'global-nda',
      dealId: '',
      dealName: 'All Deals',
      type: 'sign_nda',
      label: 'Sign NDA',
      priority: 1,
      icon: Shield,
    });
  }

  // 2. Fee Agreement — global
  const needsFee = coverage && !coverage.fee_covered && coverage.fee_status === 'sent';
  if (needsFee) {
    actions.push({
      id: 'global-fee',
      dealId: '',
      dealName: 'All Deals',
      type: 'sign_fee',
      label: 'Sign Fee Agreement',
      priority: 2,
      icon: FileSignature,
    });
  }

  // 3. Unread messages — per deal
  for (const request of requests) {
    const msgUnread = unreadMsgCounts?.byRequest[request.id] || 0;
    if (msgUnread > 0) {
      actions.push({
        id: `msg-${request.id}`,
        dealId: request.id,
        dealName: request.listing?.title || 'Untitled',
        type: 'unread_messages',
        label: `${msgUnread} unread message${msgUnread > 1 ? 's' : ''}`,
        priority: 3,
        icon: MessageSquare,
      });
    }
  }

  actions.sort((a, b) => a.priority - b.priority);

  // Don't render anything when the buyer has no pending actions
  if (actions.length === 0) return null;

  /* ── Action handler ── */

  const handleAction = (action: ActionItem) => {
    if (action.type === 'sign_nda') {
      setSigningType('nda');
      setSigningOpen(true);
    } else if (action.type === 'sign_fee') {
      setSigningType('fee_agreement');
      setSigningOpen(true);
    } else if (action.type === 'unread_messages') {
      onSelectDeal(action.dealId, 'messages');
    }
  };

  /**
   * Truncate long deal names to keep chips compact.
   * Shows first 25 chars + ellipsis for names exceeding the limit.
   */
  const truncateName = (name: string, max = 25) =>
    name.length > max ? name.slice(0, max) + '…' : name;

  /* ── Render ── */

  return (
    <>
      <div className="bg-[#0f1f3d] rounded-xl px-6 py-5">
        {/* Header row: icon + text + count */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.4)]">
            <Zap className="h-5 w-5 text-[#c9a84c]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">
              {actions.length} Action{actions.length !== 1 ? 's' : ''} Required Across Your Deals
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Complete these steps to keep your pipeline moving
            </p>
          </div>
        </div>

        {/* Action chips — wrapped flex layout for multiple actions */}
        <div className="flex flex-wrap gap-2.5">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleAction(action)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.07] border border-white/[0.15] text-white text-xs font-medium hover:bg-[rgba(201,168,76,0.2)] hover:border-[#c9a84c] transition-all group"
              >
                <Icon className="h-3.5 w-3.5 text-white/70 shrink-0" />
                <span>{action.label}</span>
                {action.dealName && (
                  <>
                    <span className="text-white/30">—</span>
                    <span className="text-[#c9a84c]">{truncateName(action.dealName)}</span>
                  </>
                )}
                <ArrowRight className="h-3 w-3 text-white/40 group-hover:text-white/70 transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Signing modal for inline NDA / Fee Agreement signing */}
      <AgreementSigningModal
        open={signingOpen}
        onOpenChange={setSigningOpen}
        documentType={signingType}
      />
    </>
  );
}
