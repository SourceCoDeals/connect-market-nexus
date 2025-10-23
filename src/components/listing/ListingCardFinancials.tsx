


interface ListingCardFinancialsProps {
  revenue: number;
  ebitda: number;
  formatCurrency: (value: number) => string;
}

const ListingCardFinancials = ({ revenue, ebitda, formatCurrency }: ListingCardFinancialsProps) => {
  const ebitdaMargin = revenue > 0 ? ((ebitda / revenue) * 100) : 0;
  
  return (
    <div className="grid grid-cols-2 gap-8 py-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
          Annual Revenue
        </p>
        <p className="text-[22px] font-medium text-slate-900 tracking-tight">{formatCurrency(revenue)}</p>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Annual EBITDA
          </p>
          <span 
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
              ebitdaMargin > 20 
                ? "bg-slate-900 text-white" 
                : ebitdaMargin > 10 
                ? "bg-slate-100 text-slate-700" 
                : "bg-slate-50 text-slate-600 border border-slate-200"
            }`}
          >
            {ebitdaMargin.toFixed(1)}%
          </span>
        </div>
        <p className="text-[22px] font-medium text-slate-900 tracking-tight">{formatCurrency(ebitda)}</p>
      </div>
    </div>
  );
};

export default ListingCardFinancials;
