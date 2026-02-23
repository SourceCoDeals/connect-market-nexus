/**
 * DealBuyerChat — thin wrapper around ReMarketingChat for deal-specific buyer queries.
 * Consolidates all streaming, persistence, analytics, and timeout logic into ReMarketingChat.
 */

import { ReMarketingChat, type ChatContext } from "./ReMarketingChat";

interface DealBuyerChatProps {
  listingId: string;
  dealName?: string;
  dealGeography?: string[];
  dealRevenue?: number;
  onHighlightBuyers?: (buyerIds: string[]) => void;
  onBuyerClick?: (buyerId: string) => void;
  approvedCount?: number;
  passedCount?: number;
  pendingCount?: number;
  className?: string;
}

export function DealBuyerChat({
  listingId,
  dealName,
  onHighlightBuyers,
  className,
}: DealBuyerChatProps) {
  const context: ChatContext = {
    type: "deal",
    dealId: listingId,
    dealName,
  };

  return (
    <ReMarketingChat
      context={context}
      onHighlightItems={onHighlightBuyers}
      className={className}
    />
  );
}

export default DealBuyerChat;
