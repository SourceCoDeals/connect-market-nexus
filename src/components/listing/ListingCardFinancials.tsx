import { memo } from 'react';

interface ListingCardFinancialsProps {
  revenue: number;
  ebitda: number;
  description?: string;
  formatCurrency: (value: number) => string;
  viewType?: 'grid' | 'list';
}

const ListingCardFinancials = memo(function ListingCardFinancials({
  revenue,
  ebitda,
  description: _description = '',
  formatCurrency,
  viewType = 'grid',
}: ListingCardFinancialsProps) {
  const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;

  return (
    <div
      className={
        viewType === 'grid'
          ? 'bg-slate-50/50 border border-slate-200/40 rounded-lg px-4 py-4 grid grid-cols-3 gap-x-4'
          : 'grid grid-cols-3 gap-x-4 gap-y-3 px-4 py-2.5 border-y border-slate-200/30'
      }
    >
      {/* Revenue */}
      <div className="flex flex-col justify-between">
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${viewType === 'grid' ? 'mb-2' : 'mb-0.5'}`}
        >
          ANNUAL REVENUE
        </p>
        <p
          className={`${viewType === 'grid' ? 'text-[18px] sm:text-[21px]' : 'text-[16px]'} font-normal text-slate-900 tracking-[-0.025em]`}
        >
          {formatCurrency(revenue)}
        </p>
      </div>

      {/* EBITDA */}
      <div className="flex flex-col justify-between">
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${viewType === 'grid' ? 'mb-2' : 'mb-0.5'}`}
        >
          EBITDA
        </p>
        <p
          className={`${viewType === 'grid' ? 'text-[18px] sm:text-[21px]' : 'text-[16px]'} font-normal text-slate-900 tracking-[-0.025em]`}
        >
          {formatCurrency(ebitda)}
        </p>
      </div>

      {/* EBITDA Margin */}
      <div className="flex flex-col justify-between">
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${viewType === 'grid' ? 'mb-2' : 'mb-0.5'}`}
        >
          EBITDA MARGIN
        </p>
        <p
          className={`${viewType === 'grid' ? 'text-[18px] sm:text-[21px]' : 'text-[16px]'} font-normal text-slate-900 tracking-[-0.025em]`}
        >
          {ebitdaMargin.toFixed(1)}%
        </p>
      </div>
    </div>
  );
});

export default ListingCardFinancials;
