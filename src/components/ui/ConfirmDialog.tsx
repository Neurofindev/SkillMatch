import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose } from '@/components/ui/Dialog';

export interface ConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  onConfirm: () => Promise<unknown> | void;
  title: string;
  trigger: React.ReactNode;
  variant?: 'primary' | 'danger';
}

export function ConfirmDialog({
  cancelLabel = 'Annuler',
  confirmLabel = 'Confirmer',
  description,
  onConfirm,
  title,
  trigger,
  variant = 'primary',
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const confirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      description={description}
      footer={
        <>
          <DialogClose asChild>
            <Button disabled={isLoading} variant="secondary">
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            isLoading={isLoading}
            loadingLabel="Confirmation en cours"
            onClick={() => void confirm()}
            variant={variant}
          >
            {confirmLabel}
          </Button>
        </>
      }
      onOpenChange={setOpen}
      open={open}
      title={title}
      trigger={trigger}
    >
      <p className="text-muted">Cette action demande votre confirmation.</p>
    </Dialog>
  );
}
