import {
  CircleAlert,
  CircleCheckBig,
  Inbox,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export interface StateAction {
  label: string;
  onClick: () => void;
}

interface StateProps {
  action?: StateAction;
  className?: string;
  description: string;
  icon?: ReactNode;
  title: string;
}

export function EmptyState({
  action,
  className,
  description,
  icon,
  title,
}: StateProps) {
  const titleId = useId();
  return (
    <section className={cn('state-panel', className)} aria-labelledby={titleId}>
      <span className="state-icon" aria-hidden="true">
        {icon ?? <Inbox />}
      </span>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      {action ? <Button onClick={action.onClick}>{action.label}</Button> : null}
    </section>
  );
}

export function ErrorState({
  action,
  className,
  description,
  icon,
  title,
}: StateProps) {
  const titleId = useId();
  return (
    <section
      className={cn('state-panel state-panel-error', className)}
      aria-labelledby={titleId}
      role="alert"
    >
      <span className="state-icon" aria-hidden="true">
        {icon ?? <CircleAlert />}
      </span>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      {action ? (
        <Button onClick={action.onClick} variant="secondary">
          <RefreshCw aria-hidden="true" size={18} />
          {action.label}
        </Button>
      ) : null}
    </section>
  );
}

export function OfflineState({
  action,
  className,
  description,
  title,
}: StateProps) {
  const titleId = useId();
  return (
    <section
      className={cn('state-panel state-panel-offline', className)}
      aria-labelledby={titleId}
      aria-live="polite"
    >
      <span className="state-icon" aria-hidden="true">
        <WifiOff />
      </span>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      {action ? (
        <Button onClick={action.onClick} variant="secondary">
          <RefreshCw aria-hidden="true" size={18} />
          {action.label}
        </Button>
      ) : null}
    </section>
  );
}

export function SuccessState({
  action,
  className,
  description,
  title,
}: StateProps) {
  const titleId = useId();
  return (
    <section
      className={cn('state-panel state-panel-success', className)}
      aria-labelledby={titleId}
      role="status"
    >
      <span className="state-icon" aria-hidden="true">
        <CircleCheckBig />
      </span>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      {action ? <Button onClick={action.onClick}>{action.label}</Button> : null}
    </section>
  );
}
