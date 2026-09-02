import { cn } from '@/lib/cn';

export interface SkeletonProps {
  className?: string;
  label?: string;
  lines?: number;
}

export function Skeleton({
  className,
  label = 'Chargement du contenu',
  lines = 3,
}: SkeletonProps) {
  return (
    <div className={cn('skeleton-stack', className)} role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, index) => (
        <span
          aria-hidden="true"
          className="skeleton-line"
          key={index}
          style={{ width: index === lines - 1 ? '68%' : '100%' }}
        />
      ))}
    </div>
  );
}
