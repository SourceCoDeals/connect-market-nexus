import { DealsKPICards } from "../components/DealsKPICards";

interface GPPartnerKPICardsProps {
  totalDeals: number;
  priorityDeals: number;
  avgScore: number;
  needsScoring: number;
}

export function GPPartnerKPICards(props: GPPartnerKPICardsProps) {
  return <DealsKPICards {...props} accent="orange" />;
}
