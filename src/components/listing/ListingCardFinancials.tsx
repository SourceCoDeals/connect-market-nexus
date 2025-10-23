
import { extractFinancialMetrics } from "@/lib/financial-parser";

interface ListingCardFinancialsProps {
  revenue: number;
  ebitda: number;
  description?: string;
  formatCurrency: (value: number) => string;
  fullTimeEmployees?: number;
  partTimeEmployees?: number;
}

const ListingCardFinancials = ({ 
  revenue, 
  ebitda, 
  description = "", 
  formatCurrency,
  fullTimeEmployees = 0,
  partTimeEmployees = 0
}: ListingCardFinancialsProps) => {
  const extractedMetrics = extractFinancialMetrics(description);
  const ebitdaMargin = revenue > 0 ? ((ebitda / revenue) * 100) : 0;
  const totalEmployees = fullTimeEmployees + partTimeEmployees;
  
  return (
    <div className="grid grid-cols-2 gap-6 px-5 py-4 border-y border-slate-200/30">
      {/* Revenue */}
      <div className="flex flex-col justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
          ANNUAL REVENUE
        </p>
        <p className="text-[20px] font-normal text-slate-900 tracking-[-0.025em]">
          {formatCurrency(revenue)}
        </p>
      </div>

      {/* EBITDA */}
      <div className="flex flex-col justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
          EBITDA
        </p>
        <p className="text-[20px] font-normal text-slate-900 tracking-[-0.025em]">
          {formatCurrency(ebitda)}
        </p>
      </div>

      {/* EBITDA Margin */}
      <div className="flex flex-col justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
          EBITDA MARGIN
        </p>
        <p className="text-[20px] font-normal text-slate-900 tracking-[-0.025em]">
          {ebitdaMargin.toFixed(1)}%
        </p>
      </div>

      {/* Employees */}
      <div className="flex flex-col justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
          EMPLOYEES
        </p>
        <p className="text-[20px] font-normal text-slate-900 tracking-[-0.025em]">
          {totalEmployees > 0 ? totalEmployees : '—'}
        </p>
      </div>
    </div>
  );
};

export default ListingCardFinancials;
