import { useState } from 'react';
import { AlertTriangle, FileSignature, Shield, ArrowRight, MessageSquare, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMyAgreementStatus } from '@/hooks/use-agreement-status';
import { useBuyerNdaStatus } from '@/hooks/admin/use-docuseal';
import { useAuth } from '@/context/AuthContext';
import { AgreementSigningModal } from '@/components/docuseal/AgreementSigningModal';
import { cn } from '@/lib/utils';
import type { ConnectionRequest } from '@/types';

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
  type: 'sign_nda' | 'sign_fee' | 'unread_messages' | 'pending_review';
  label: string;
  description: string;
  priority: number;
  icon: typeof AlertTriangle;
  color: string;
}

export function ActionHub({ requests, unreadByRequest, unreadMsgCounts, onSelectDeal }: ActionHubProps) {
  const { user, isAdmin } = useAuth();
  const { data: ndaStatus } = useBuyerNdaStatus(!isAdmin ? user?.id : undefined);
  const { data: coverage } = useMyAgreementStatus(!isAdmin && !!user);
  const [signingOpen, setSigningOpen] = useState(false);
  const [signingType, setSigningType] = useState<'nda' | 'fee_agreement'>('nda');

  const actions: ActionItem[] = [];

  // NDA signing action (global, not per-deal)
  const needsNda = ndaStatus?.hasFirm && !ndaStatus.ndaSigned && ndaStatus.hasSubmission;
  if (needsNda) {
    actions.push({
      id: 'global-nda',
      dealId: '',
      dealName: 'All Deals',
      type: 'sign_nda',
      label: 'Sign NDA',
      description: 'A Non-Disclosure Agreement is ready for your signature',
      priority: 1,
      icon: Shield,
      color: 'text-amber-600',
    });
  }

  // Fee agreement action (global)
  const needsFee = coverage && !coverage.fee_covered && coverage.fee_status === 'sent';
  if (needsFee) {
    actions.push({
      id: 'global-fee',
      dealId: '',
      dealName: 'All Deals',
      type: 'sign_fee',
      label: 'Sign Fee Agreement',
      description: 'A Fee Agreement is ready for your signature',
      priority: 2,
      icon: FileSignature,
      color: 'text-amber-600',
    });
  }

  // Unread messages per deal
  for (const request of requests) {
    const msgUnread = unreadMsgCounts?.byRequest[request.id] || 0;
    if (msgUnread > 0) {
      actions.push({
        id: `msg-${request.id}`,
        dealId: request.id,
        dealName: request.listing?.title || 'Untitled',
        type: 'unread_messages',
        label: `${msgUnread} unread message${msgUnread > 1 ? 's' : ''}`,
        description: request.listing?.title || 'Untitled Deal',
        priority: 3,
        icon: MessageSquare,
        color: 'text-blue-600',
      });
    }
  }

  // Sort by priority
  actions.sort((a, b) => a.priority - b.priority);

  if (actions.length === 0) return null;

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

  return (
    <>
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-amber-200/60 flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Action Required</h3>
          <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
            {actions.length}
          </span>
        </div>

        <div className="divide-y divide-amber-200/40">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleAction(action)}
                className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-amber-50/60 transition-colors text-left group"
              >
                <Icon className={cn('h-4 w-4 shrink-0', action.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{action.label}</p>
                  <p className="text-xs text-slate-500 truncate">{action.description}</p>
                </div>
                {action.dealName && action.dealId && (
                  <span className="text-[10px] font-medium text-slate-400 shrink-0 hidden sm:block">
                    {action.dealName.length > 20 ? action.dealName.slice(0, 20) + '...' : action.dealName}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      <AgreementSigningModal
        open={signingOpen}
        onOpenChange={setSigningOpen}
        documentType={signingType}
      />
    </>
  );
}
