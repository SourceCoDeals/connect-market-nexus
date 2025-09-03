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
      <h4 className="text-sm font-medium text-gray-900">Quick Actions</h4>
      
      {/* Single row of minimal actions */}
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
                "flex-1 justify-center gap-1.5 text-xs font-medium h-7 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400",
                action.disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {action.label}
            </Button>
          );
        })}
      </div>

      {/* Secondary note action - minimal style */}
      {onLogNote && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogNote}
          className="w-full justify-start gap-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 h-7 px-2"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Add Note
        </Button>
      )}
    </div>
  );
}