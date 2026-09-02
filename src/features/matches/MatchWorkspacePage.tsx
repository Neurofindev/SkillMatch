import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import {
  addProgress,
  cancelMatch,
  completeMatch,
  confirmAgreement,
  getFrenchMatchError,
  getMatchWorkspace,
  matchQueryKeys,
  startMatch,
  submitCompletion,
} from '@/features/matches/matchApi';
import { MatchTimeline } from '@/features/matches/MatchTimeline';
import {
  cancellationSchema,
  completionSchema,
  type CancellationValues,
  type CompletionValues,
  type MatchWorkspace,
  type ProgressValues,
  progressSchema,
} from '@/features/matches/matchSchemas';
import { getAvatarPublicUrl } from '@/features/profiles/avatar';
import { getSupabaseClient } from '@/lib/supabase/client';

function deliverableLabel(value: string | { label: string }): string {
  return typeof value === 'string' ? value : value.label;
}

function formatBudget(workspace: MatchWorkspace): string {
  const agreement = workspace.agreement;
  if (!agreement || agreement.budgetMin === null) return 'Non renseigné';
  const formatter = new Intl.NumberFormat('fr-FR', {
    currency: agreement.currencyCode,
    style: 'currency',
  });
  const suffix = agreement.budgetModel === 'hourly' ? ' / heure' : '';
  if (agreement.budgetMax && agreement.budgetMax !== agreement.budgetMin) {
    return `${formatter.format(agreement.budgetMin)} – ${formatter.format(agreement.budgetMax)}${suffix}`;
  }
  return `${formatter.format(agreement.budgetMin)}${suffix}`;
}

export function MatchWorkspacePage() {
  const { matchId = '' } = useParams();
  const client = getSupabaseClient();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState('');
  const workspaceQuery = useQuery({
    enabled: Boolean(client && matchId),
    queryFn: () => getMatchWorkspace(client!, matchId),
    queryKey: matchQueryKeys.detail(matchId),
  });
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: matchQueryKeys.detail(matchId),
      }),
      queryClient.invalidateQueries({ queryKey: matchQueryKeys.list }),
    ]);
  };
  const actionMutation = useMutation({
    mutationFn: async (
      action:
        | { type: 'confirm' | 'start' | 'complete' }
        | { type: 'progress'; values: ProgressValues }
        | { type: 'completion'; values: CompletionValues }
        | { type: 'cancel'; reason: string },
    ) => {
      if (!client || !workspaceQuery.data) throw new Error('MATCH_NOT_FOUND');
      if (action.type === 'confirm')
        await confirmAgreement(client, workspaceQuery.data);
      if (action.type === 'start')
        await startMatch(client, workspaceQuery.data);
      if (action.type === 'complete')
        await completeMatch(client, workspaceQuery.data);
      if (action.type === 'progress') {
        await addProgress(
          client,
          matchId,
          action.values.kind,
          action.values.note,
        );
      }
      if (action.type === 'completion') {
        await submitCompletion(
          client,
          matchId,
          action.values.decision,
          action.values.note,
        );
      }
      if (action.type === 'cancel')
        await cancelMatch(client, workspaceQuery.data, action.reason);
    },
    onError: (error) => setActionError(getFrenchMatchError(error)),
    onMutate: () => setActionError(''),
    onSuccess: invalidate,
  });
  const progressForm = useForm<ProgressValues>({
    defaultValues: { kind: 'progress', note: '' },
    resolver: zodResolver(progressSchema),
  });
  const completionForm = useForm<CompletionValues>({
    defaultValues: { decision: 'confirmed', note: '' },
    resolver: zodResolver(completionSchema),
  });
  const cancellationForm = useForm<CancellationValues>({
    defaultValues: { reason: '' },
    resolver: zodResolver(cancellationSchema),
  });

  if (workspaceQuery.isLoading) {
    return <Skeleton label="Chargement du suivi" lines={12} />;
  }
  if (workspaceQuery.isError) {
    const message = getFrenchMatchError(workspaceQuery.error);
    return (
      <ErrorState
        action={{
          label: 'Réessayer',
          onClick: () => void workspaceQuery.refetch(),
        }}
        description={message}
        title={
          message.includes('autorisé')
            ? 'Accès non autorisé'
            : 'Suivi indisponible'
        }
      />
    );
  }
  if (!workspaceQuery.data) {
    return (
      <EmptyState
        description="Ce suivi a été supprimé ou n’existe plus."
        title="Ressource introuvable"
      />
    );
  }

  const workspace = workspaceQuery.data;
  const agreement = workspace.agreement;
  const self =
    workspace.match.role === 'client' ? workspace.client : workspace.talent;
  const counterpart =
    workspace.match.role === 'client' ? workspace.talent : workspace.client;
  const avatarUrl = client
    ? getAvatarPublicUrl(client, counterpart.avatarPath)
    : undefined;
  const ownAgreementConfirmed =
    workspace.match.role === 'client'
      ? Boolean(agreement?.clientConfirmedAt)
      : Boolean(agreement?.talentConfirmedAt);
  const ownCompletion = workspace.completionConfirmations.find(
    (confirmation) => confirmation.participantId === self.id,
  );
  const canConfirmAgreement =
    Boolean(agreement) &&
    workspace.match.status === 'active' &&
    workspace.mission.status === 'assigned' &&
    !ownAgreementConfirmed;
  const canStart =
    agreement?.status === 'confirmed' &&
    workspace.mission.status === 'assigned';
  const inProgress =
    workspace.match.status === 'active' &&
    workspace.mission.status === 'in_progress';
  const allCompleted =
    workspace.completionConfirmations.length === 2 &&
    workspace.completionConfirmations.every(
      ({ decision }) => decision === 'confirmed',
    );
  const canCancel =
    workspace.match.role === 'client' &&
    workspace.match.status === 'active' &&
    ['assigned', 'in_progress'].includes(workspace.mission.status);

  return (
    <section className="match-workspace-page">
      <Link className="back-link" to="/espace/matches">
        <ArrowLeft aria-hidden="true" size={18} /> Retour aux suivis
      </Link>
      <header className="match-workspace-heading">
        <div>
          <Badge>
            {workspace.match.status === 'completed'
              ? 'Terminée'
              : workspace.match.status === 'cancelled'
                ? 'Annulée'
                : 'Collaboration active'}
          </Badge>
          <h1>{workspace.mission.title}</h1>
          <p>
            {workspace.match.role === 'client'
              ? 'Espace client'
              : 'Espace talent'}{' '}
            · données partagées avec les deux participants uniquement
          </p>
        </div>
        {workspace.match.conversationId ? (
          <Link
            className="button button-secondary"
            to={`/espace/messages/${workspace.match.conversationId}`}
          >
            <MessageCircle aria-hidden="true" size={18} /> Conversation
          </Link>
        ) : null}
      </header>
      {actionError ? (
        <p className="field-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {workspace.match.status === 'cancelled' ? (
        <div className="status-banner status-banner-warning" role="status">
          Cette mission est annulée. Le motif reste visible dans la chronologie.
        </div>
      ) : null}
      {workspace.match.status === 'completed' ? (
        <div className="status-banner status-banner-success" role="status">
          <CheckCircle2 aria-hidden="true" size={20} />
          <span>Mission terminée et clôturée par les états réels.</span>
          <Link to={`/espace/avis/${workspace.match.id}`}>
            Laisser un avis vérifié
          </Link>
        </div>
      ) : null}

      <div className="match-workspace-grid">
        <main>
          <Card>
            <div className="agreement-heading">
              <div>
                <p className="eyebrow">Version {agreement?.version ?? '—'}</p>
                <h2>Accord de mission informatif</h2>
              </div>
              <Badge>{agreement?.status ?? 'indisponible'}</Badge>
            </div>
            {!agreement ? (
              <p className="inline-empty">
                L’accord n’est pas disponible. Rechargez le suivi.
              </p>
            ) : (
              <>
                <dl className="agreement-facts">
                  <div>
                    <dt>Périmètre</dt>
                    <dd className="preserve-lines">{agreement.scope}</dd>
                  </div>
                  <div>
                    <dt>Dates</dt>
                    <dd>
                      {agreement.startsOn ?? 'À convenir'} →{' '}
                      {agreement.endsOn ?? 'À convenir'}
                    </dd>
                  </div>
                  <div>
                    <dt>Budget informatif figé</dt>
                    <dd>{formatBudget(workspace)}</dd>
                  </div>
                </dl>
                <h3>Livrables</h3>
                {agreement.deliverables.length ? (
                  <ul>
                    {agreement.deliverables.map((item, index) => (
                      <li key={`${deliverableLabel(item)}-${index}`}>
                        {deliverableLabel(item)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    Aucun livrable distinct n’a été renseigné dans la mission.
                  </p>
                )}
                <p className="platform-notice">{agreement.platformNotice}</p>
                <div
                  className="agreement-confirmations"
                  aria-label="Confirmations de l’accord"
                >
                  <span
                    className={
                      agreement.clientConfirmedAt ? 'is-confirmed' : ''
                    }
                  >
                    Client :{' '}
                    {agreement.clientConfirmedAt ? 'confirmé' : 'en attente'}
                  </span>
                  <span
                    className={
                      agreement.talentConfirmedAt ? 'is-confirmed' : ''
                    }
                  >
                    Talent :{' '}
                    {agreement.talentConfirmedAt ? 'confirmé' : 'en attente'}
                  </span>
                </div>
                {canConfirmAgreement ? (
                  <ConfirmDialog
                    confirmLabel="Confirmer cet accord"
                    description="Votre confirmation est horodatée séparément. L’accord ne constitue pas une signature électronique qualifiée."
                    onConfirm={() =>
                      actionMutation.mutateAsync({ type: 'confirm' })
                    }
                    title="Confirmer la version actuelle ?"
                    trigger={
                      <Button disabled={actionMutation.isPending}>
                        Confirmer l’accord
                      </Button>
                    }
                  />
                ) : agreement.status === 'client_confirmed' ||
                  agreement.status === 'talent_confirmed' ? (
                  <p className="inline-empty">
                    Votre confirmation est enregistrée. En attente de l’autre
                    participant.
                  </p>
                ) : null}
                {canStart ? (
                  <ConfirmDialog
                    confirmLabel="Démarrer la mission"
                    description="La mission et cette version de l’accord passeront ensemble à l’état en cours."
                    onConfirm={() =>
                      actionMutation.mutateAsync({ type: 'start' })
                    }
                    title="Démarrer le travail ?"
                    trigger={<Button>Démarrer la mission</Button>}
                  />
                ) : null}
              </>
            )}
          </Card>

          {inProgress ? (
            <Card>
              <h2>Ajouter au suivi</h2>
              <form
                onSubmit={progressForm.handleSubmit(async (values) => {
                  await actionMutation.mutateAsync({
                    type: 'progress',
                    values,
                  });
                  progressForm.reset({ kind: values.kind, note: '' });
                })}
              >
                <FormField id="progress-kind" label="Type d’événement" required>
                  {(props) => (
                    <Select {...props} {...progressForm.register('kind')}>
                      <option value="progress">Note d’avancement</option>
                      {workspace.match.role === 'talent' ? (
                        <option value="delivery">Livraison</option>
                      ) : null}
                    </Select>
                  )}
                </FormField>
                <FormField
                  error={progressForm.formState.errors.note?.message}
                  id="progress-note"
                  label="Note"
                  required
                >
                  {(props) => (
                    <Textarea {...props} {...progressForm.register('note')} />
                  )}
                </FormField>
                <Button isLoading={actionMutation.isPending} type="submit">
                  Enregistrer dans la chronologie
                </Button>
              </form>
            </Card>
          ) : null}

          {inProgress && !ownCompletion ? (
            <Card>
              <h2>Confirmer la fin</h2>
              <p>
                Chaque participant enregistre une décision distincte. Deux
                confirmations conformes sont requises pour clôturer.
              </p>
              <form
                onSubmit={completionForm.handleSubmit((values) =>
                  actionMutation.mutateAsync({ type: 'completion', values }),
                )}
              >
                <FormField id="completion-decision" label="Décision" required>
                  {(props) => (
                    <Select {...props} {...completionForm.register('decision')}>
                      <option value="confirmed">Confirmer la fin</option>
                      <option value="disputed">Signaler un désaccord</option>
                    </Select>
                  )}
                </FormField>
                <FormField
                  error={completionForm.formState.errors.note?.message}
                  id="completion-note"
                  label="Note"
                >
                  {(props) => (
                    <Textarea {...props} {...completionForm.register('note')} />
                  )}
                </FormField>
                <Button type="submit">Enregistrer ma décision</Button>
              </form>
            </Card>
          ) : ownCompletion ? (
            <Card>
              <h2>Votre décision de fin</h2>
              <p>
                {ownCompletion.decision === 'confirmed'
                  ? 'Fin confirmée'
                  : 'Désaccord signalé'}{' '}
                · décision horodatée et non modifiable.
              </p>
            </Card>
          ) : null}

          {inProgress && allCompleted ? (
            <ConfirmDialog
              confirmLabel="Clôturer la mission"
              description="Les deux confirmations sont enregistrées. La mission, le match et l’accord seront clôturés ensemble."
              onConfirm={() => actionMutation.mutateAsync({ type: 'complete' })}
              title="Clôturer définitivement ?"
              trigger={<Button>Clôturer la mission</Button>}
            />
          ) : null}

          <Card>
            <h2>Chronologie réelle</h2>
            <p>
              Seuls les événements persistés par le serveur apparaissent ici.
            </p>
            <MatchTimeline events={workspace.events} />
          </Card>
        </main>

        <aside className="match-side-panel">
          <Card>
            <p className="eyebrow">Autre participant</p>
            <div className="application-profile-heading">
              <Avatar
                name={counterpart.displayName}
                size="lg"
                {...(avatarUrl ? { src: avatarUrl } : {})}
              />
              <div>
                <h2>{counterpart.displayName}</h2>
                <p>@{counterpart.username}</p>
              </div>
            </div>
            {counterpart.emailVerified ? (
              <Badge tone="success">
                <ShieldCheck aria-hidden="true" size={14} /> E-mail vérifié
              </Badge>
            ) : null}
            {counterpart.headline ? <p>{counterpart.headline}</p> : null}
            <small>
              Seules les informations publiques autorisées sont affichées.
            </small>
          </Card>
          {canCancel ? (
            <Card className="danger-zone">
              <h2>Annuler la mission</h2>
              <p>
                L’annulation après assignation exige un motif, visible dans le
                journal partagé.
              </p>
              <FormField
                error={cancellationForm.formState.errors.reason?.message}
                id="cancellation-reason"
                label="Motif"
                required
              >
                {(props) => (
                  <Textarea
                    {...props}
                    {...cancellationForm.register('reason')}
                  />
                )}
              </FormField>
              <ConfirmDialog
                confirmLabel="Annuler la mission"
                description="La mission et le match seront annulés. Le motif sera conservé dans la chronologie."
                onConfirm={() =>
                  cancellationForm.handleSubmit((values) =>
                    actionMutation.mutateAsync({
                      type: 'cancel',
                      reason: values.reason,
                    }),
                  )()
                }
                title="Confirmer l’annulation ?"
                trigger={<Button variant="danger">Continuer</Button>}
                variant="danger"
              />
            </Card>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
