import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, EyeOff, ShieldAlert, UserX } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Pagination,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import {
  getFrenchSafetyError,
  getModerationReport,
  listModerationReports,
  moderateReport,
  type ModerationStatus,
} from '@/features/safety/safetyApi';
import {
  moderationActionSchema,
  type ModerationActionValues,
} from '@/features/safety/safetySchemas';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getSupabaseClient } from '@/lib/supabase/client';

const moderationQueryKeys = {
  all: ['moderation'] as const,
  detail: (id: string) => ['moderation', 'detail', id] as const,
  list: (status: ModerationStatus | null, page: number) =>
    ['moderation', 'list', status, page] as const,
};

const statusLabels: Record<ModerationStatus, string> = {
  actioned: 'Action prise',
  dismissed: 'Classé sans suite',
  submitted: 'Nouveau',
  triaged: 'En examen',
};

const targetLabels = {
  message: 'Message',
  mission: 'Mission',
  profile: 'Profil',
  review: 'Avis',
} as const;

const reasonLabels: Record<string, string> = {
  abuse: 'Comportement abusif',
  dangerous_activity: 'Activité dangereuse',
  discrimination: 'Discrimination',
  fraud: 'Fraude ou tromperie',
  harassment: 'Harcèlement ou menace',
  illegal_activity: 'Activité illégale',
  impersonation: 'Usurpation',
  other: 'Autre',
  sensitive_data: 'Données sensibles',
  spam: 'Spam',
};

const targetFieldLabels: Record<string, string> = {
  authorId: 'Identifiant de l’auteur',
  body: 'Contenu',
  comment: 'Commentaire',
  conversationId: 'Identifiant de la conversation',
  createdAt: 'Créé le',
  description: 'Description',
  displayName: 'Nom affiché',
  headline: 'Accroche',
  hiddenAt: 'Masqué le',
  id: 'Identifiant',
  ownerId: 'Identifiant du propriétaire',
  rating: 'Note',
  status: 'État',
  suspendedAt: 'Suspendu le',
  title: 'Titre',
  unavailable: 'Indisponible',
  username: 'Username',
};

const auditActionLabels: Record<string, string> = {
  dismissed: 'Classé sans suite',
  mission_hidden: 'Mission masquée',
  profile_suspended: 'Profil suspendu',
  resolved: 'Clôturé avec action documentaire',
  triaged: 'Placé en examen',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function ModerationQueuePage() {
  useDocumentTitle('File de modération');
  const client = getSupabaseClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ModerationStatus | null>(null);
  const reportsQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => listModerationReports(client!, status, page),
    queryKey: moderationQueryKeys.list(status, page),
  });

  if (reportsQuery.isPending) {
    return <Skeleton label="Chargement de la file de modération" lines={6} />;
  }
  if (reportsQuery.isError) {
    const message = getFrenchSafetyError(reportsQuery.error);
    return (
      <ErrorState
        action={{
          label: 'Réessayer',
          onClick: () => void reportsQuery.refetch(),
        }}
        description={message}
        title={
          message.includes('autorisée')
            ? 'Accès non autorisé'
            : 'File indisponible'
        }
      />
    );
  }

  return (
    <section className="moderation-page">
      <header className="page-heading-row">
        <div>
          <p className="eyebrow">Accès contrôlé par user_roles</p>
          <h1>File de modération</h1>
          <p>
            Les décisions sont limitées au contenu nécessaire et chaque action
            est journalisée côté base.
          </p>
        </div>
        <ShieldAlert aria-hidden="true" size={34} />
      </header>
      <Card className="moderation-filter-card">
        <label htmlFor="moderation-status">État</label>
        <Select
          id="moderation-status"
          onChange={(event) => {
            setStatus((event.target.value || null) as ModerationStatus | null);
            setPage(1);
          }}
          value={status ?? ''}
        >
          <option value="">Tous les états</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Card>
      {reportsQuery.data.items.length === 0 ? (
        <EmptyState
          description="Aucun signalement réel ne correspond à ce filtre."
          title="File vide"
        />
      ) : (
        <div className="moderation-report-list">
          {reportsQuery.data.items.map((report) => (
            <Card key={report.id}>
              <div className="moderation-report-heading">
                <div>
                  <Badge>{targetLabels[report.targetType]}</Badge>
                  <Badge
                    tone={report.status === 'submitted' ? 'warning' : 'neutral'}
                  >
                    {statusLabels[report.status]}
                  </Badge>
                </div>
                <time dateTime={report.createdAt}>
                  {formatDate(report.createdAt)}
                </time>
              </div>
              <h2>{report.targetLabel}</h2>
              <p className="eyebrow">{reasonLabels[report.reason]}</p>
              <p className="moderation-description">{report.description}</p>
              <Link
                className="button button-secondary"
                to={`/espace/moderation/${report.id}`}
              >
                Examiner le signalement
              </Link>
            </Card>
          ))}
        </div>
      )}
      {reportsQuery.data.total > 20 ? (
        <Pagination
          currentPage={page}
          onPageChange={setPage}
          totalPages={Math.ceil(reportsQuery.data.total / 20)}
        />
      ) : null}
    </section>
  );
}

export function ModerationDetailPage() {
  const { reportId = '' } = useParams();
  useDocumentTitle('Examen du signalement');
  const client = getSupabaseClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState('');
  const detailQuery = useQuery({
    enabled: Boolean(client && reportId),
    queryFn: () => getModerationReport(client!, reportId),
    queryKey: moderationQueryKeys.detail(reportId),
  });
  const form = useForm<ModerationActionValues>({
    defaultValues: { action: 'triage', reason: '' },
    resolver: zodResolver(moderationActionSchema),
  });
  const selectedAction = useWatch({ control: form.control, name: 'action' });
  const mutation = useMutation({
    mutationFn: (values: ModerationActionValues) => {
      if (!client || !detailQuery.data)
        throw new Error('MODERATION_UNAVAILABLE');
      return moderateReport(client, {
        ...values,
        expectedVersion: detailQuery.data.report.lockVersion,
        reportId,
      });
    },
    onError: (error) => setActionError(getFrenchSafetyError(error)),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: moderationQueryKeys.all }),
        detailQuery.refetch(),
      ]);
      setActionError('');
      form.reset();
    },
  });

  if (detailQuery.isPending)
    return <Skeleton label="Chargement du signalement" lines={7} />;
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        action={{
          label: 'Retour à la file',
          onClick: () => navigate('/espace/moderation'),
        }}
        description={getFrenchSafetyError(detailQuery.error)}
        title="Signalement indisponible"
      />
    );
  }
  const detail = detailQuery.data;
  const resolved = ['actioned', 'dismissed'].includes(detail.report.status);

  return (
    <section className="moderation-detail-page">
      <Link className="back-link" to="/espace/moderation">
        <ArrowLeft aria-hidden="true" size={18} /> Retour à la file
      </Link>
      <header className="page-heading-row">
        <div>
          <p className="eyebrow">{targetLabels[detail.report.targetType]}</p>
          <h1>{reasonLabels[detail.report.reason]}</h1>
          <p>
            Signalé par {detail.reporter.displayName} (@
            {detail.reporter.username}) le {formatDate(detail.report.createdAt)}
            .
          </p>
        </div>
        <Badge
          tone={detail.report.status === 'submitted' ? 'warning' : 'neutral'}
        >
          {statusLabels[detail.report.status]}
        </Badge>
      </header>
      <div className="moderation-detail-grid">
        <div>
          <Card>
            <h2>Description du signalement</h2>
            <p className="preserve-lines">{detail.report.description}</p>
          </Card>
          <Card>
            <h2>Ressource limitée</h2>
            <dl className="safe-target-details">
              {Object.entries(detail.target).map(([key, value]) => (
                <div key={key}>
                  <dt>{targetFieldLabels[key] ?? key}</dt>
                  <dd>
                    {value === null
                      ? '—'
                      : typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <h2>Journal d’audit</h2>
            {detail.actions.length === 0 ? (
              <p>Aucune action n’a encore été enregistrée.</p>
            ) : (
              <ol className="moderation-audit-list">
                {detail.actions.map((action) => (
                  <li key={action.id}>
                    <strong>
                      {auditActionLabels[action.action] ?? action.action}
                    </strong>
                    <span>{formatDate(action.createdAt)}</span>
                    <p>{action.reason}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
        <Card className="moderation-action-card">
          <h2>Décision</h2>
          {resolved ? (
            <p>
              Ce signalement est clôturé. Motif :{' '}
              {detail.report.resolutionNote ?? 'non renseigné'}
            </p>
          ) : (
            <form
              noValidate
              onSubmit={(event) =>
                void form.handleSubmit((values) => mutation.mutate(values))(
                  event,
                )
              }
            >
              <FormField
                error={form.formState.errors.action?.message}
                id="moderation-action"
                label="Action"
                required
              >
                {(props) => (
                  <Select {...props} {...form.register('action')}>
                    <option value="triage">Placer en examen</option>
                    <option value="resolve">
                      Clôturer avec action documentaire
                    </option>
                    <option value="dismiss">Classer sans suite</option>
                    {detail.report.targetType === 'mission' ? (
                      <option value="hide_mission">Masquer la mission</option>
                    ) : null}
                    <option value="suspend_profile">
                      Suspendre l’auteur ciblé
                    </option>
                  </Select>
                )}
              </FormField>
              <FormField
                description="Le motif sera conservé dans le journal d’audit."
                error={form.formState.errors.reason?.message}
                id="moderation-reason"
                label="Motif de la décision"
                required
              >
                {(props) => (
                  <Textarea
                    {...props}
                    maxLength={1000}
                    {...form.register('reason')}
                  />
                )}
              </FormField>
              <Button
                isLoading={mutation.isPending}
                type="submit"
                variant="danger"
              >
                {selectedAction === 'hide_mission' ? (
                  <EyeOff aria-hidden="true" size={18} />
                ) : selectedAction === 'suspend_profile' ? (
                  <UserX aria-hidden="true" size={18} />
                ) : null}
                Confirmer la décision
              </Button>
              {actionError ? (
                <p className="field-error" role="alert">
                  {actionError}
                </p>
              ) : null}
            </form>
          )}
        </Card>
      </div>
    </section>
  );
}
