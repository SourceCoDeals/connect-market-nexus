import React from 'react';
import { Switch } from '@/components/ui/switch';
import { FileText, Shield, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MinimalDocumentToggleProps {
  type: 'nda' | 'fee_agreement';
  status: string;
  onStatusChange: (status: string) => void;
  lastActivity?: {
    admin_name?: string;
    timestamp?: string;
  };
  className?: string;
}

export function MinimalDocumentToggle({ 
  type, 
  status, 
  onStatusChange, 
  lastActivity,
  className 
}: MinimalDocumentToggleProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'signed':
        return {
          icon: CheckCircle,
          label: 'Signed',
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-200/60'
        };
      case 'sent':
        return {
          icon: Clock,
          label: 'Sent',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200/60'
        };
      case 'declined':
        return {
          icon: XCircle,
          label: 'Declined',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200/60'
        };
      default:
        return {
          icon: AlertCircle,
          label: 'Not Sent',
          color: 'text-slate-500',
          bgColor: 'bg-slate-50',
          borderColor: 'border-slate-200/60'
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;
  const DocumentIcon = type === 'nda' ? Shield : FileText;

  return (
    <div className={cn("flex items-center justify-between p-4 rounded-xl border transition-all", config.borderColor, config.bgColor, className)}>
      <div className="flex items-center gap-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", config.bgColor)}>
          <DocumentIcon className={cn("w-4 h-4", config.color)} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {type === 'nda' ? 'NDA' : 'Fee Agreement'}
            </span>
            <div className="flex items-center gap-1.5">
              <Icon className={cn("w-3.5 h-3.5", config.color)} />
              <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
            </div>
          </div>
          {lastActivity?.admin_name && (
            <p className="text-xs text-slate-500 mt-0.5">
              by {lastActivity.admin_name}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Switch
          checked={status === 'signed'}
          onCheckedChange={(checked) => onStatusChange(checked ? 'signed' : 'not_sent')}
          className="data-[state=checked]:bg-emerald-500"
        />
      </div>
    </div>
  );
}