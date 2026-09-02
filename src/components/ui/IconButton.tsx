import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label'
> {
  children: ReactNode;
  isLoading?: boolean;
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { children, className, disabled, isLoading = false, label, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      aria-busy={isLoading || undefined}
      aria-label={label}
      className={cn('icon-button', className)}
      disabled={disabled || isLoading}
      type="button"
      {...props}
    >
      {isLoading ? (
        <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" />
      ) : (
        children
      )}
    </button>
  ),
);

IconButton.displayName = 'IconButton';
