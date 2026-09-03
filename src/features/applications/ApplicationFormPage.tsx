import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Eye, Send } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Skeleton,
  Textarea,
} from '@/components/ui';
import {
  applicationQueryKeys,
  getFrenchApplicationError,
  listApplications,
  submitApplication,
} from '@/features/applications/applicationApi';
import { getApplicationEligibility } from '@/features/applications/applicationEligibility';
import {
  applicationFormSchema,
  type ApplicationFormValues,
} from '@/features/applications/applicationSchemas';
import { formatMissionBudget } from '@/features/missions/missionView';
import {
  missionQueryKeys,
  searchMissions,
} from '@/features/missions/missionApi';
import { getSupabaseClient } from '@/lib/supabase/client';

export function ApplicationFormPage() {
  const { missionId = '' } = useParams();
  const auth = useAuth();
  const client = getSupabaseClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<ApplicationFormValues>();
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationError, setConfirmationError] = useState('');
  const form = useForm<ApplicationFormValues>({
    defaultValues: { availabilityNote: '', message: '' },
    resolver: zodResolver(applicationFormSchema),
    shouldFocusError: true,
  });

  const missionQuery = useQuery({
    enabled: Boolean(client && missionId),
    queryFn: () =>
      searchMissions(client!, {
        missionId,
        page: 1,
        pageSize: 1,
        requiredLevels: [],
        skillIds: [],
        sort: 'relevance',
        workModes: [],
      }),
    queryKey: missionQueryKeys.detail(missionId),
  });
  const existingQuery = useQuery({
    enabled: Boolean(client && missionId),
    queryFn: () =>
      listApplications(client!, {
        missionId,
        page: 1,
        pageSize: 10,
        scope: 'talent',
        sort: 'newest',
        statuses: ['submitted', 'viewed', 'shortlisted', 'accepted'],
      }),
    queryKey: applicationQueryKeys.list({
      missionId,
      page: 1,
      pageSize: 10,
      scope: 'talent',
      sort: 'newest',
      statuses: ['submitted', 'viewed', 'shortlisted', 'accepted'],
    }),
  });
  const mission = missionQuery.data?.items[0];

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!client || !preview) throw new Error('AUTH_REQUIRED');
      if (!confirmed) throw new Error('CONFIRMATION_REQUIRED');
      return submitApplication(client, {
        availabilityNote: preview.availabilityNote,
        message: preview.message,
        missionId,
        ...(preview.proposedAmount !== undefined
          ? { proposedAmount: preview.proposedAmount }
          : {}),
      });
    },
    onError: (error) => {
      if ((error as Error).message === 'CONFIRMATION_REQUIRED') {
        setConfirmationError(
          'Confirmez explicitement l’envoi de cette candidature.',
        );
      }
    },
    onSuccess: async (applicationId) => {
      await queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.all,
      });
      navigate(`/espace/candidatures/${applicationId}`, { replace: true });
    },
  });

  if (missionQuery.isLoading || existingQuery.isLoading) {
    return <Skeleton label="Chargement de la candidature" lines={8} />;
  }
  if (missionQuery.isError || existingQuery.isError) {
    const error = missionQuery.error ?? existingQuery.error;
    return (
      <ErrorState
        action={{
          label: 'Réessayer',
          onClick: () =>
            void Promise.all([missionQuery.refetch(), existingQuery.refetch()]),
        }}
        description={getFrenchApplicationError(error)}
        title="Le formulaire ne peut pas être chargé"
      />
    );
  }
  if (!mission) {
    return (
      <EmptyState
        description="Cette mission n’est plus ouverte ou ne vous est pas accessible."
        title="Mission indisponible"
      />
    );
  }
  const existing = existingQuery.data?.items[0];
  if (existing) {
    return (
      <EmptyState
        action={{
          label: 'Voir ma candidature',
          onClick: () => navigate(`/espace/candidatures/${existing.id}`),
        }}
        description="Une candidature active existe déjà pour cette mission."
        title="Candidature déjà envoyée"
      />
    );
  }
  const eligibility = getApplicationEligibility(mission, {
    canWork: Boolean(auth.profile?.canWork),
    id: auth.user?.id ?? '',
  });
  if (!eligibility.allowed) {
    const action =
      eligibility.reason === 'owner'
        ? {
            label: 'Gérer la mission',
            onClick: () => navigate(`/espace/missions/${mission.id}`),
          }
        : eligibility.reason === 'work-capability-required'
          ? {
              label: 'Modifier mes capacités',
              onClick: () => navigate('/espace/profil#capacites'),
            }
          : undefined;
    return (
      <EmptyState
        {...(action ? { action } : {})}
        description={eligibility.description}
        title={eligibility.title}
      />
    );
  }

  return (
    <section className="application-form-page">
      <Link className="back-link" to={`/espace/missions/${mission.id}`}>
        <ArrowLeft aria-hidden="true" size={18} /> Retour à la mission
      </Link>
      <header>
        <p className="eyebrow">Candidature explicite</p>
        <h1>
          {preview ? 'Prévisualiser la candidature' : 'Candidater à la mission'}
        </h1>
        <p>{mission.title}</p>
      </header>

      {!preview ? (
        <Card className="application-form-card">
          <form
            noValidate
            onSubmit={form.handleSubmit((values) => {
              setPreview(values);
              setConfirmed(false);
              setConfirmationError('');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            })}
          >
            <FormField
              error={form.formState.errors.message?.message}
              id="application-message"
              label="Message au client"
              required
            >
              {(props) => (
                <Textarea
                  {...props}
                  {...form.register('message')}
                  placeholder="Expliquez votre approche, votre expérience utile et les questions importantes."
                  rows={8}
                />
              )}
            </FormField>
            <FormField
              description="Cette information aide le client à comparer les candidatures."
              error={form.formState.errors.availabilityNote?.message}
              id="application-availability"
              label="Disponibilité"
              required
            >
              {(props) => (
                <Textarea
                  {...props}
                  {...form.register('availabilityNote')}
                  placeholder="Ex. Disponible dès le 15 septembre, trois jours par semaine."
                  rows={4}
                />
              )}
            </FormField>
            <FormField
              description={`Facultatif. ${formatMissionBudget(mission)}. Ce montant n’entraîne aucun paiement sur SkillMatch.`}
              error={form.formState.errors.proposedAmount?.message}
              id="application-proposal"
              label={`Proposition informative${mission.budgetModel === 'hourly' ? ' par heure' : ''}`}
            >
              {(props) => (
                <Input
                  {...props}
                  {...form.register('proposedAmount', {
                    setValueAs: (value) =>
                      value === '' ? undefined : Number(value),
                  })}
                  inputMode="decimal"
                  min="0"
                  placeholder="Facultatif"
                  step="0.01"
                  type="number"
                />
              )}
            </FormField>
            <aside className="mission-non-payment-note">
              <strong>Montants purement informatifs</strong>
              <p>
                SkillMatch facilite la mise en relation et ne traite aucun
                paiement. Les modalités de rémunération sont gérées directement
                entre les participants.
              </p>
            </aside>
            <Button type="submit">
              <Eye aria-hidden="true" size={18} /> Prévisualiser
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="application-preview-card">
          <div className="application-preview-heading">
            <Badge tone="info">Aucun envoi effectué</Badge>
            <h2>{mission.title}</h2>
          </div>
          <section>
            <h3>Message</h3>
            <p>{preview.message}</p>
          </section>
          <section>
            <h3>Disponibilité</h3>
            <p>{preview.availabilityNote}</p>
          </section>
          <section>
            <h3>Proposition</h3>
            <p>
              {preview.proposedAmount === undefined
                ? 'Aucune proposition facultative.'
                : `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(preview.proposedAmount)}${mission.budgetModel === 'hourly' ? ' / heure' : ''} · information uniquement`}
            </p>
          </section>
          <Checkbox
            checked={confirmed}
            label="Je confirme vouloir envoyer cette candidature avec ces informations."
            onChange={(event) => {
              setConfirmed(event.target.checked);
              if (event.target.checked) setConfirmationError('');
            }}
          />
          {confirmationError ? (
            <p className="field-error" role="alert">
              {confirmationError}
            </p>
          ) : null}
          {submitMutation.isError && !confirmationError ? (
            <p className="field-error" role="alert">
              {getFrenchApplicationError(submitMutation.error)}
            </p>
          ) : null}
          <div className="application-preview-actions">
            <Button onClick={() => setPreview(undefined)} variant="secondary">
              Modifier
            </Button>
            <Button
              isLoading={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              <Send aria-hidden="true" size={18} /> Confirmer l’envoi
            </Button>
          </div>
          <p className="application-confirmation-note">
            <CheckCircle2 aria-hidden="true" size={17} /> Le swipe ne peut
            jamais déclencher cet envoi.
          </p>
        </Card>
      )}
    </section>
  );
}
