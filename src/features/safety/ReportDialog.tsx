import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  Button,
  Checkbox,
  Dialog,
  DialogClose,
  FormField,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import {
  getFrenchSafetyError,
  submitReport,
  type ReportTargetType,
} from '@/features/safety/safetyApi';
import {
  reportFormSchema,
  type ReportFormValues,
} from '@/features/safety/safetySchemas';
import { getSupabaseClient } from '@/lib/supabase/client';

export const reportReasonLabels = {
  abuse: 'Comportement abusif',
  dangerous_activity: 'Activité dangereuse',
  discrimination: 'Discrimination',
  fraud: 'Fraude ou tromperie',
  harassment: 'Harcèlement ou menace',
  illegal_activity: 'Activité illégale',
  impersonation: 'Usurpation',
  other: 'Autre infraction',
  sensitive_data: 'Demande de données sensibles',
  spam: 'Spam',
} as const;

export function ReportDialog({
  label = 'Signaler',
  targetId,
  targetLabel,
  targetType,
}: {
  label?: string;
  targetId: string;
  targetLabel: string;
  targetType: ReportTargetType;
}) {
  const client = getSupabaseClient();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setFocus,
  } = useForm<ReportFormValues>({
    defaultValues: { confirmed: false, description: '', reason: 'other' },
    resolver: zodResolver(reportFormSchema),
  });
  const mutation = useMutation({
    mutationFn: (values: ReportFormValues) => {
      if (!client) throw new Error('SUPABASE_UNAVAILABLE');
      return submitReport(client, {
        confirmed: true,
        description: values.description,
        reason: values.reason,
        targetId,
        targetType,
      });
    },
    onError: (error) => setSubmitError(getFrenchSafetyError(error)),
    onSuccess: () => {
      notify({
        description:
          'Le signalement est enregistré et accessible uniquement à la modération autorisée.',
        title: 'Signalement envoyé',
        tone: 'success',
      });
      reset();
      setOpen(false);
    },
  });

  useEffect(() => {
    const firstError = Object.keys(errors)[0] as
      keyof ReportFormValues | undefined;
    if (firstError) setFocus(firstError);
  }, [errors, setFocus]);

  return (
    <Dialog
      description={`Le signalement de ${targetLabel} est privé. N’ajoutez aucune donnée sensible inutile.`}
      footer={
        <>
          <DialogClose asChild>
            <Button disabled={mutation.isPending} variant="secondary">
              Annuler
            </Button>
          </DialogClose>
          <Button
            isLoading={mutation.isPending}
            onClick={() =>
              void handleSubmit((values) => mutation.mutate(values))()
            }
            variant="danger"
          >
            Envoyer le signalement
          </Button>
        </>
      }
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setSubmitError('');
      }}
      open={open}
      title={`Signaler ${targetLabel}`}
      trigger={
        <Button variant="quiet">
          <Flag aria-hidden="true" size={17} /> {label}
        </Button>
      }
    >
      <form className="report-form" noValidate>
        <FormField
          error={errors.reason?.message}
          id={`report-${targetType}-reason`}
          label="Catégorie"
          required
        >
          {(props) => (
            <Select {...props} {...register('reason')}>
              {Object.entries(reportReasonLabels).map(
                ([value, reasonLabel]) => (
                  <option key={value} value={value}>
                    {reasonLabel}
                  </option>
                ),
              )}
            </Select>
          )}
        </FormField>
        <FormField
          description="20 à 1 500 caractères, uniquement les faits nécessaires."
          error={errors.description?.message}
          id={`report-${targetType}-description`}
          label="Description factuelle"
          required
        >
          {(props) => (
            <Textarea
              {...props}
              maxLength={1500}
              {...register('description')}
            />
          )}
        </FormField>
        <div>
          <Checkbox
            label="Je confirme que ce signalement est factuel et demande son examen par la modération."
            {...register('confirmed')}
          />
          {errors.confirmed ? (
            <p className="field-error" role="alert">
              {errors.confirmed.message}
            </p>
          ) : null}
        </div>
        {submitError ? (
          <p className="field-error" role="alert">
            {submitError}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
