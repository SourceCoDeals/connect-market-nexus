import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { CreateDealFormData } from './schema';

interface AutoPopulationNoticeProps {
  autoPopulatedFrom: {
    source: 'user' | 'company';
    name: string;
    email: string;
  };
  form: UseFormReturn<CreateDealFormData>;
  onDismiss: () => void;
}

export function AutoPopulationNotice({ autoPopulatedFrom, form, onDismiss }: AutoPopulationNoticeProps) {
  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            📋 Auto-populated from {autoPopulatedFrom.source === 'user' ? 'user profile' : 'company profile'}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Contact details were automatically filled using data from <strong>{autoPopulatedFrom.name}</strong> ({autoPopulatedFrom.email})
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            // Clear auto-filled fields
            if (autoPopulatedFrom && autoPopulatedFrom.source === 'company') {
              form.setValue('contact_phone', '');
            }
            onDismiss();
          }}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors font-medium"
        >
          Clear & Dismiss
        </button>
      </div>
    </div>
  );
}
