import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface BuyerProfileStatusProps {
  isComplete?: boolean;
  completionPercentage?: number;
}

export function BuyerProfileStatus({ 
  isComplete = false, 
  completionPercentage = 0 
}: BuyerProfileStatusProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Buyer Profile
        </h3>
        <div className="flex items-center gap-1.5">
          {isComplete ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span className="text-xs text-slate-600">Complete</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3 text-amber-500" />
              <span className="text-xs text-slate-600">Incomplete</span>
            </>
          )}
        </div>
      </div>
      
      {!isComplete && completionPercentage > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Profile completeness</span>
            <span className="font-mono text-xs text-slate-900">{completionPercentage}%</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-slate-900 transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      )}
      
      <Link
        to="/profile"
        className="inline-flex items-center gap-1 text-sm text-slate-900 hover:text-slate-600 transition-colors duration-200 group"
      >
        <span>Review profile</span>
        <span className="transform group-hover:translate-x-0.5 transition-transform duration-200">→</span>
      </Link>
    </div>
  );
}
