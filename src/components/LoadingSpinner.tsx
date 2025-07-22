import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'overlay' | 'inline' | 'button';
  message?: string;
  className?: string;
  showMessage?: boolean;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const variantClasses = {
  default: 'text-primary',
  overlay: 'text-white',
  inline: 'text-muted-foreground',
  button: 'text-current',
};

export function LoadingSpinner({ 
  size = 'md', 
  variant = 'default', 
  message = 'Loading...', 
  className,
  showMessage = false 
}: LoadingSpinnerProps) {
  const spinnerClasses = cn(
    'animate-spin',
    sizeClasses[size],
    variantClasses[variant],
    className
  );

  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background p-6 rounded-lg shadow-lg flex flex-col items-center gap-3">
          <Loader2 className={cn(spinnerClasses, 'text-primary')} />
          {showMessage && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className={spinnerClasses} />
        {showMessage && (
          <span className="text-sm text-muted-foreground">{message}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-4">
      <Loader2 className={spinnerClasses} />
      {showMessage && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}

// Specialized loading components
export function OverlaySpinner({ message = 'Loading...', showMessage = true }: { message?: string; showMessage?: boolean }) {
  return <LoadingSpinner variant="overlay" size="lg" message={message} showMessage={showMessage} />;
}

export function InlineSpinner({ message, showMessage = false, size = 'sm' as const }: { message?: string; showMessage?: boolean; size?: 'sm' | 'md' }) {
  return <LoadingSpinner variant="inline" size={size} message={message} showMessage={showMessage} />;
}

export function ButtonSpinner({ size = 'sm' as const }: { size?: 'sm' | 'md' }) {
  return <LoadingSpinner variant="button" size={size} />;
}