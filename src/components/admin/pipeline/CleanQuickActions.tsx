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
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-medium text-gray-900">Quick Actions</h4>
      
      {/* Primary action row */}
      <div className="flex gap-2">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant={action.primary ? "default" : "outline"}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                "flex-1 justify-center gap-2 text-xs font-medium",
                action.primary 
                  ? "bg-blue-600 hover:bg-blue-700 text-white border-0" 
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              <Icon className="w-4 h-4" />
              {action.label}
            </Button>
          );
        })}
      </div>

      {/* Secondary note action */}
      {onLogNote && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogNote}
          className="w-full justify-start gap-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 h-8"
        >
          <MessageSquare className="w-4 h-4" />
          Add Note
        </Button>
      )}
    </div>
  );
}