import { formatDistanceToNow } from 'date-fns';
import { cn, formatCompactCurrency } from '@/lib/utils';
import { MessageSquare, Clock, ChevronRight } from 'lucide-react';
import type { ConnectionRequest } from '@/types';
import {
  TechnologyIcon,
  HealthcareIcon,
  ManufacturingIcon,
  FinanceIcon,
  RetailIcon,
  RealEstateIcon,
  FoodBeverageIcon,
  ProfessionalServicesIcon,
  ConstructionIcon,
  TransportationIcon,
  EducationIcon,
  HospitalityIcon,
  EnergyIcon,
  MediaIcon,
  AutomotiveIcon,
  AgricultureIcon,
  TelecommunicationsIcon,
  ConsumerGoodsIcon,
  BusinessServicesIcon,
  DefaultCategoryIcon,
} from '@/components/icons/CategoryIcons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Pipeline stages in order
const PIPELINE_STAGES = [
  { id: 'interested', label: 'Interested', description: 'You expressed interest in this deal' },
  { id: 'nda_signed', label: 'NDA Signed', description: 'Non-disclosure agreement has been signed' },
  { id: 'cim_received', label: 'CIM Received', description: 'Confidential Information Memorandum received' },
  { id: 'ioi_submitted', label: 'IOI Submitted', description: 'Indication of Interest has been submitted' },
  { id: 'loi', label: 'LOI', description: 'Letter of Intent stage' },
  { id: 'closed', label: 'Closed', description: 'Deal has been closed' },
] as const;

type PipelineStageId = typeof PIPELINE_STAGES[number]['id'];

interface DealPipelineCardProps {
  request: ConnectionRequest;
  isSelected: boolean;
  unreadCount: number;
  ndaSigned?: boolean;
  hasCim?: boolean;
  onSelect: () => void;
  pendingAction?: string;
}

function getCategoryIcon(category?: string) {
  if (!category) return DefaultCategoryIcon;
  const cat = category.toLowerCase();
  if (cat.includes('technology') || cat.includes('software')) return TechnologyIcon;
  if (cat.includes('healthcare') || cat.includes('medical')) return HealthcareIcon;
  if (cat.includes('manufacturing')) return ManufacturingIcon;
  if (cat.includes('finance') || cat.includes('insurance')) return FinanceIcon;
  if (cat.includes('retail') || cat.includes('e-commerce')) return RetailIcon;
  if (cat.includes('real estate')) return RealEstateIcon;
  if (cat.includes('food') || cat.includes('beverage')) return FoodBeverageIcon;
  if (cat.includes('professional services')) return ProfessionalServicesIcon;
  if (cat.includes('construction')) return ConstructionIcon;
  if (cat.includes('transportation') || cat.includes('logistics')) return TransportationIcon;
  if (cat.includes('education')) return EducationIcon;
  if (cat.includes('hospitality') || cat.includes('tourism')) return HospitalityIcon;
  if (cat.includes('energy') || cat.includes('utilities')) return EnergyIcon;
  if (cat.includes('media') || cat.includes('entertainment')) return MediaIcon;
  if (cat.includes('automotive')) return AutomotiveIcon;
  if (cat.includes('agriculture')) return AgricultureIcon;
  if (cat.includes('telecommunications')) return TelecommunicationsIcon;
  if (cat.includes('consumer goods')) return ConsumerGoodsIcon;
  if (cat.includes('business services')) return BusinessServicesIcon;
  return DefaultCategoryIcon;
}

function getCurrentStage(status: string, ndaSigned?: boolean, hasCim?: boolean): PipelineStageId {
  if (status === 'rejected') return 'interested';
  if (hasCim) return 'cim_received';
  if (ndaSigned) return 'nda_signed';
  return 'interested';
}

function getStageIndex(stageId: PipelineStageId): number {
  return PIPELINE_STAGES.findIndex(s => s.id === stageId);
}

const stageColors: Record<PipelineStageId, { bg: string; text: string; border: string }> = {
  interested: { bg: 'bg-[#F5F0E8]', text: 'text-[#8B6F47]', border: 'border-[#E5DDD0]' },
  nda_signed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  cim_received: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  ioi_submitted: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  loi: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  closed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
};

export function DealPipelineCard({
  request,
  isSelected,
  unreadCount,
  ndaSigned,
  hasCim,
  onSelect,
  pendingAction,
}: DealPipelineCardProps) {
  const CategoryIcon = getCategoryIcon(request.listing?.category);
  const currentStage = getCurrentStage(request.status, ndaSigned, hasCim);
  const currentStageIndex = getStageIndex(currentStage);
  const stageLabel = PIPELINE_STAGES.find(s => s.id === currentStage)?.label || 'Interested';
  const colors = stageColors[currentStage];
  const isRejected = request.status === 'rejected';

  const revenueRange = request.listing?.revenue
    ? formatCompactCurrency(request.listing.revenue)
    : null;

  return (
    <TooltipProvider>
      <button
        onClick={onSelect}
        className={cn(
          'w-full text-left rounded-xl border transition-all duration-200 p-4 group relative',
          isSelected
            ? 'border-slate-900 bg-white shadow-[0_2px_12px_0_rgba(0,0,0,0.08)] ring-1 ring-slate-900/5'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_0_rgba(0,0,0,0.04)]',
          isRejected && 'opacity-60'
        )}
      >
        {/* Top row: Icon + Title + Status pill */}
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            isSelected ? 'bg-slate-900' : 'bg-slate-100 group-hover:bg-slate-200'
          )}>
            <CategoryIcon className={cn(
              'h-4.5 w-4.5',
              isSelected ? 'text-white' : 'text-slate-600'
            )} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 truncate">
                {request.listing?.title || 'Untitled'}
              </h3>
              {unreadCount > 0 && (
                <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white shrink-0">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>

            {/* Category + Revenue */}
            <div className="flex items-center gap-2 mt-0.5">
              {request.listing?.category && (
                <span className="text-xs text-slate-500 truncate">
                  {request.listing.category}
                </span>
              )}
              {revenueRange && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs font-medium text-slate-600">{revenueRange}</span>
                </>
              )}
            </div>
          </div>

          <ChevronRight className={cn(
            'h-4 w-4 shrink-0 mt-1 transition-colors',
            isSelected ? 'text-slate-900' : 'text-slate-300 group-hover:text-slate-400'
          )} />
        </div>

        {/* Pipeline progress bar */}
        <div className="mt-3 flex items-center gap-0.5">
          {PIPELINE_STAGES.map((stage, i) => {
            const isCompleted = i <= currentStageIndex;
            const isCurrent = i === currentStageIndex;
            return (
              <Tooltip key={stage.id} delayDuration={200}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-all duration-300',
                      isCompleted && !isRejected ? 'bg-slate-800' : 'bg-slate-100',
                      isRejected && isCompleted ? 'bg-slate-300' : '',
                      isCurrent && !isRejected && 'bg-slate-900'
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-medium">{stage.label}</p>
                  <p className="text-muted-foreground">{stage.description}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Bottom row: Stage pill + Last activity + Quick action */}
        <div className="mt-2.5 flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
            isRejected ? 'bg-slate-50 text-slate-500 border-slate-200' : colors.bg,
            isRejected ? '' : colors.text,
            isRejected ? '' : colors.border,
          )}>
            {isRejected ? 'Not Selected' : stageLabel}
          </span>

          <span className="flex items-center gap-1 text-[10px] text-slate-400 ml-auto">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(request.updated_at || request.created_at), { addSuffix: true })}
          </span>

          {pendingAction && !isRejected && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
              {pendingAction}
            </span>
          )}
        </div>
      </button>
    </TooltipProvider>
  );
}
