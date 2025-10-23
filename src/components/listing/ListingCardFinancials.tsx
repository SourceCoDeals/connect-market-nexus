
import { extractFinancialMetrics } from "@/lib/financial-parser";

interface ListingCardFinancialsProps {
  revenue: number;
  ebitda: number;
  description?: string;
  formatCurrency: (value: number) => string;
  fullTimeEmployees?: number;
  partTimeEmployees?: number;
  viewType?: "grid" | "list";
}

const ListingCardFinancials = ({ 
  revenue, 
  ebitda, 
  description = "", 
  formatCurrency,
  fullTimeEmployees = 0,
  partTimeEmployees = 0,
  viewType = "grid"
}: ListingCardFinancialsProps) => {
  const extractedMetrics = extractFinancialMetrics(description);
  const ebitdaMargin = revenue > 0 ? ((ebitda / revenue) * 100) : 0;
  const totalEmployees = fullTimeEmployees + partTimeEmployees;
  
  return (
    <div className={
      viewType === "grid" 
        ? "bg-slate-50/50 border border-slate-200/40 rounded-lg px-4 py-4 grid grid-cols-2 gap-y-4 gap-x-6"
        : "grid grid-cols-2 gap-x-6 gap-y-5 px-5 py-4 border-y border-slate-200/30"
    }>
      {/* Revenue */}
      <div className="flex flex-col justify-between">
        <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${viewType === "grid" ? "mb-2" : "mb-2"}`}>
          ANNUAL REVENUE
        </p>
        <p className={`${viewType === "grid" ? "text-[21px]" : "text-[20px]"} font-normal text-slate-900 tracking-[-0.025em]`}>
          {formatCurrency(revenue)}
        </p>
      </div>

      {/* EBITDA */}
      <div className="flex flex-col justify-between">
        <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${viewType === "grid" ? "mb-2" : "mb-2"}`}>
          EBITDA
        </p>
        <p className={`${viewType === "grid" ? "text-[21px]" : "text-[20px]"} font-normal text-slate-900 tracking-[-0.025em]`}>
          {formatCurrency(ebitda)}
        </p>
      </div>

      {/* EBITDA Margin */}
      <div className="flex flex-col justify-between">
        <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${viewType === "grid" ? "mb-2" : "mb-2"}`}>
          EBITDA MARGIN
        </p>
        <p className={`${viewType === "grid" ? "text-[21px]" : "text-[20px]"} font-normal text-slate-900 tracking-[-0.025em]`}>
          {ebitdaMargin.toFixed(1)}%
        </p>
      </div>

      {/* Employees */}
      <div className="flex flex-col justify-between">
        <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${viewType === "grid" ? "mb-2" : "mb-2"}`}>
          EMPLOYEES
        </p>
        <p className={`${viewType === "grid" ? "text-[21px]" : "text-[20px]"} font-normal text-slate-900 tracking-[-0.025em]`}>
          {totalEmployees > 0 ? totalEmployees : '—'}
        </p>
      </div>
    </div>
  );
};

export default ListingCardFinancials;
