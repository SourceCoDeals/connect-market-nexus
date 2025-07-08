
interface ListingCardFinancialsProps {
  revenue: number;
  ebitda: number;
  formatCurrency: (value: number) => string;
}

const ListingCardFinancials = ({ revenue, ebitda, formatCurrency }: ListingCardFinancialsProps) => {
  return (
    <div className="grid grid-cols-2 gap-3 mb-3">
      <div>
        <p className="text-xs text-muted-foreground">Annual Revenue</p>
        <p className="font-semibold">{formatCurrency(revenue)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Annual EBITDA</p>
        <p className="font-semibold">{formatCurrency(ebitda)}</p>
      </div>
    </div>
  );
};

export default ListingCardFinancials;
