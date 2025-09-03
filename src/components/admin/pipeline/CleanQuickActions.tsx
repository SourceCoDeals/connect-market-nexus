import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Mail, 
  Phone, 
  Plus, 
  Activity,
  MessageSquare,
  Calendar,
  FileText,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CleanQuickActionsProps {
  buyerEmail?: string;
  buyerPhone?: string;
  onEmailContact: () => void;
  onPhoneContact: () => void;
  onCreateTask: () => void;
  onViewActivity: () => void;
  onLogNote?: () => void;
  className?: string;
}

export function CleanQuickActions({
  buyerEmail,
  buyerPhone,
  onEmailContact,
  onPhoneContact,
  onCreateTask,
  onViewActivity,
  onLogNote,
  className
}: CleanQuickActionsProps) {
  const actions = [
    {
      label: 'Email',
      icon: Mail,
      onClick: onEmailContact,
      disabled: !buyerEmail,
      primary: true
    },
    {
      label: 'Call',
      icon: Phone,
      onClick: onPhoneContact,
      disabled: !buyerPhone,
      primary: false
    },
    {
      label: 'Task',
      icon: Plus,
      onClick: onCreateTask,
      disabled: false,
      primary: false
    },
    {
      label: 'Activity',
      icon: Activity,
      onClick: onViewActivity,
      disabled: false,
      primary: false
    }
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
          <Activity className="w-4 h-4 text-slate-600" />
        </div>
        <h4 className="text-base font-semibold text-slate-900">Quick Actions</h4>
      </div>
      
      {/* Minimal horizontal action row */}
      <div className="flex gap-2">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                "flex-1 justify-center gap-2 text-xs font-medium h-9 border-slate-200/60 text-slate-700 hover:bg-slate-50 hover:border-slate-300/60 transition-all",
                action.disabled && "opacity-40 cursor-not-allowed",
                action.primary && "border-blue-200/60 text-blue-700 hover:bg-blue-50/60 hover:border-blue-300/60"
              )}
            >
              <Icon className="w-4 h-4" />
              {action.label}
            </Button>
          );
        })}
      </div>

      {/* Note action below */}
      {onLogNote && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogNote}
          className="w-full justify-center gap-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50/60 h-8 transition-all"
        >
          <MessageSquare className="w-4 h-4" />
          Add Note
        </Button>
      )}
    </div>
  );
}