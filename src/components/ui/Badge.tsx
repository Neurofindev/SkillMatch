import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({
  children,
  className,
  tone = 'neutral',
  ...props
}: BadgeProps) {
  return (
    <span className={cn('badge', `badge-${tone}`, className)} {...props}>
      {children}
    </span>
  );
}
