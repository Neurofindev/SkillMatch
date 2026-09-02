import {
  CheckCircle2,
  Info,
  OctagonAlert,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { IconButton } from '@/components/ui/IconButton';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastInput {
  description?: string;
  title: string;
  tone?: ToastTone;
}

interface ToastItem extends ToastInput {
  id: number;
  tone: ToastTone;
}

interface ToastContextValue {
  dismiss: (id: number) => void;
  notify: (toast: ToastInput) => number;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: OctagonAlert,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    ({ description, title, tone = 'info' }: ToastInput) => {
      const id = nextId.current++;
      const toast: ToastItem = {
        id,
        title,
        tone,
        ...(description ? { description } : {}),
      };
      setToasts((current) => [...current.slice(-2), toast]);
      window.setTimeout(() => dismiss(id), 6000);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ dismiss, notify }), [dismiss, notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-label="Notifications" role="region">
        {toasts.map((toast) => {
          const Icon = icons[toast.tone];
          return (
            <div
              className={`toast toast-${toast.tone}`}
              key={toast.id}
              role={toast.tone === 'danger' ? 'alert' : 'status'}
            >
              <Icon aria-hidden="true" size={20} />
              <div>
                <strong>{toast.title}</strong>
                {toast.description ? <p>{toast.description}</p> : null}
              </div>
              <IconButton
                label="Fermer la notification"
                onClick={() => dismiss(toast.id)}
              >
                <X aria-hidden="true" size={18} />
              </IconButton>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast doit être utilisé dans ToastProvider.');
  }
  return context;
}
