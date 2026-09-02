import { ArrowLeft, ArrowRight, ArrowUp, ExternalLink } from 'lucide-react';
import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import { Button } from '@/components/ui/Button';

interface SwipeAction {
  label: string;
  onAction: () => void;
}

export interface AccessibleSwipeCardProps {
  children: ReactNode;
  leftAction: SwipeAction;
  middleAction?: SwipeAction;
  onOpen?: () => void;
  openLabel?: string;
  rightAction: SwipeAction;
}

export function AccessibleSwipeCard({
  children,
  leftAction,
  middleAction,
  onOpen,
  openLabel = 'Ouvrir',
  rightAction,
}: AccessibleSwipeCardProps) {
  const startX = useRef<number | undefined>(undefined);
  const [offset, setOffset] = useState(0);

  const finishGesture = (event: PointerEvent<HTMLDivElement>) => {
    if (startX.current === undefined) return;
    const distance = event.clientX - startX.current;
    startX.current = undefined;
    setOffset(0);
    if (distance <= -72) leftAction.onAction();
    else if (distance >= 72) rightAction.onAction();
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      leftAction.onAction();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      rightAction.onAction();
    } else if (event.key === 'ArrowUp' && middleAction) {
      event.preventDefault();
      middleAction.onAction();
    } else if (event.key === 'Enter' && onOpen) {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <div className="swipe-card-shell">
      <div
        aria-label="Carte de décision. Utilisez les boutons ou les flèches du clavier."
        className="swipe-card"
        onKeyDown={handleKeyboard}
        onPointerCancel={() => {
          startX.current = undefined;
          setOffset(0);
        }}
        onPointerDown={(event) => {
          startX.current = event.clientX;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (startX.current !== undefined) {
            setOffset(
              Math.max(-96, Math.min(96, event.clientX - startX.current)),
            );
          }
        }}
        onPointerUp={finishGesture}
        role="group"
        style={{ '--swipe-offset': `${offset}px` } as CSSProperties}
        tabIndex={0}
      >
        {children}
      </div>
      <p className="swipe-help">
        Glissez ou utilisez ← {middleAction ? '↑ ' : ''}→. Les mêmes actions
        restent disponibles ci-dessous.
      </p>
      <div className="swipe-actions">
        <Button onClick={leftAction.onAction} variant="secondary">
          <ArrowLeft aria-hidden="true" size={18} /> {leftAction.label}
        </Button>
        {middleAction ? (
          <Button onClick={middleAction.onAction} variant="secondary">
            <ArrowUp aria-hidden="true" size={18} /> {middleAction.label}
          </Button>
        ) : null}
        <Button onClick={rightAction.onAction} variant="primary">
          {rightAction.label} <ArrowRight aria-hidden="true" size={18} />
        </Button>
        {onOpen ? (
          <Button onClick={onOpen} variant="quiet">
            <ExternalLink aria-hidden="true" size={18} /> {openLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
