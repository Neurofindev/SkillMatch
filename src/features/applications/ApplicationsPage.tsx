import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  GitCompareArrows,
  RotateCcw,
  Search,
  Star,
  UserRoundSearch,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
  Tabs,
} from '@/components/ui';
import {
  type ApplicationFilters,
  type ApplicationItem,
  type ApplicationStatus,
  applicationQueryKeys,
  getFrenchApplicationError,
  listApplications,
  recordApplicationSwipe,
  transitionApplication,
  undoLastApplicationSwipe,
} from '@/features/applications/applicationApi';
import { RelevanceScore } from '@/features/applications/RelevanceScore';
import {
  canReview,
  canWithdraw,
  formatApplicationDate,
  formatApplicationStatus,
  formatProposal,
} from '@/features/applications/applicationView';
import { getAvatarPublicUrl } from '@/features/profiles/avatar';
import {
  acceptApplication,
  getFrenchMatchError,
  matchQueryKeys,
} from '@/features/matches/matchApi';
import { getSupabaseClient } from '@/lib/supabase/client';

const activeStatuses: ApplicationStatus[] = [
  'submitted',
  'viewed',
  'shortlisted',
];

function ApplicationList({ scope }: { scope: 'received' | 'talent' }) {
  const client = getSupabaseClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [sort, setSort] = useState<ApplicationFilters['sort']>('newest');
  const [page, setPage] = useState(1);
  const filters = useMemo<ApplicationFilters>(
    () => ({
      page,
      pageSize: 12,
      ...(query.trim() ? { query: query.trim() } : {}),
      scope,
      sort,
      statuses: status ? [status] : [],
    }),
    [page, query, scope, sort, status],
  );
  const applicationsQuery = useQuery({
    enabled: Boolean(client),
    placeholderData: (previous) => previous,
    queryFn: () => listApplications(client!, filters),
    queryKey: applicationQueryKeys.list(filters),
  });
  const [actionError, setActionError] = useState('');
  const actionMutation = useMutation({
    mutationFn: async ({
      application,
      action,
    }: {
      action: 'accept' | 'compare' | 'reject' | 'shortlist' | 'withdraw';
      application: ApplicationItem;
    }) => {
      if (!client) throw new Error('AUTH_REQUIRED');
      if (action === 'accept') {
        return acceptApplication(client, application);
      }
      if (action === 'compare' || action === 'shortlist') {
        await recordApplicationSwipe(client, application, action);
      } else {
        await transitionApplication(
          client,
          application,
          action === 'reject' ? 'rejected' : 'withdrawn',
        );
      }
    },
    onError: (error, variables) =>
      setActionError(
        variables.action === 'accept'
          ? getFrenchMatchError(error)
          : getFrenchApplicationError(error),
      ),
    onMutate: () => setActionError(''),
    onSuccess: async (matchId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: applicationQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: matchQueryKeys.all }),
      ]);
      if (matchId) void navigate(`/espace/matches/${matchId}`);
    },
  });
  const undoMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('AUTH_REQUIRED');
      await undoLastApplicationSwipe(client);
    },
    onError: (error) => setActionError(getFrenchApplicationError(error)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.all,
      });
    },
  });

  if (applicationsQuery.isLoading) {
    return <Skeleton label="Chargement des candidatures" lines={9} />;
  }
  if (applicationsQuery.isError) {
    return (
      <ErrorState
        action={{
          label: 'Réessayer',
          onClick: () => void applicationsQuery.refetch(),
        }}
        description={getFrenchApplicationError(applicationsQuery.error)}
        title="Les candidatures ne peuvent pas être chargées"
      />
    );
  }

  const items = applicationsQuery.data?.items ?? [];
  const compared = items.filter((item) => item.swipeDecision === 'compare');
  const grouped = items.reduce<Map<string, ApplicationItem[]>>(
    (result, item) => {
      const values = result.get(item.mission.id) ?? [];
      values.push(item);
      result.set(item.mission.id, values);
      return result;
    },
    new Map(),
  );
  const totalPages = Math.max(
    1,
    Math.ceil((applicationsQuery.data?.total ?? 0) / filters.pageSize),
  );

  const card = (application: ApplicationItem) => {
    const avatarPath =
      scope === 'received'
        ? application.applicant.avatarPath
        : application.owner.avatarPath;
    const displayName =
      scope === 'received'
        ? application.applicant.displayName
        : application.owner.displayName;
    const avatarUrl =
      client && avatarPath ? getAvatarPublicUrl(client, avatarPath) : undefined;
    const isPending =
      actionMutation.isPending &&
      actionMutation.variables?.application.id === application.id;
    return (
      <Card className="application-card" key={application.id}>
        <div className="application-card-heading">
          <div>
            <Badge>{formatApplicationStatus(application.status)}</Badge>
            <h3>
              <Link to={`/espace/candidatures/${application.id}`}>
                {scope === 'received'
                  ? application.applicant.displayName
                  : application.mission.title}
              </Link>
            </h3>
          </div>
          <span>{formatApplicationDate(application.createdAt)}</span>
        </div>
        <div className="application-public-person">
          <Avatar
            name={displayName}
            size="sm"
            {...(avatarUrl ? { src: avatarUrl } : {})}
          />
          <div>
            <strong>{displayName}</strong>
            <span>
              @
              {scope === 'received'
                ? application.applicant.username
                : application.owner.username}
            </span>
          </div>
        </div>
        {scope === 'received' ? (
          <RelevanceScore compact details={application.relevance} />
        ) : null}
        <p className="application-message-excerpt">{application.message}</p>
        <dl className="application-facts">
          <div>
            <dt>Disponibilité</dt>
            <dd>{application.availabilityNote}</dd>
          </div>
          <div>
            <dt>Proposition</dt>
            <dd>{formatProposal(application)}</dd>
          </div>
        </dl>
        <div className="application-card-actions">
          <Link
            className="button button-secondary"
            to={`/espace/candidatures/${application.id}`}
          >
            Ouvrir <ArrowRight aria-hidden="true" size={18} />
          </Link>
          {scope === 'received' && canReview(application.status) ? (
            <>
              <Button
                disabled={isPending}
                onClick={() =>
                  actionMutation.mutate({ action: 'compare', application })
                }
                variant="secondary"
              >
                <GitCompareArrows aria-hidden="true" size={18} /> Comparer
              </Button>
              <Button
                disabled={isPending}
                onClick={() =>
                  actionMutation.mutate({ action: 'shortlist', application })
                }
              >
                <Star aria-hidden="true" size={18} /> Présélectionner
              </Button>
              <ConfirmDialog
                confirmLabel="Refuser la candidature"
                description="Le refus est final pour cette candidature. Aucun geste de swipe ne peut le déclencher."
                onConfirm={() =>
                  actionMutation.mutateAsync({ action: 'reject', application })
                }
                title="Confirmer le refus"
                trigger={<Button variant="danger">Refuser</Button>}
                variant="danger"
              />
              {application.status === 'shortlisted' ? (
                <ConfirmDialog
                  confirmLabel="Accepter cette candidature"
                  description="Une seule candidature sera acceptée. Les autres candidatures encore ouvertes seront refusées, puis un match, une conversation et un accord informatif uniques seront créés."
                  onConfirm={() =>
                    actionMutation.mutateAsync({
                      action: 'accept',
                      application,
                    })
                  }
                  title="Retenir ce talent ?"
                  trigger={<Button disabled={isPending}>Accepter</Button>}
                />
              ) : null}
            </>
          ) : null}
          {scope === 'talent' && canWithdraw(application.status) ? (
            <ConfirmDialog
              confirmLabel="Retirer ma candidature"
              description="Cette candidature ne pourra plus être réactivée."
              onConfirm={() =>
                actionMutation.mutateAsync({ action: 'withdraw', application })
              }
              title="Retirer la candidature ?"
              trigger={<Button variant="danger">Retirer</Button>}
              variant="danger"
            />
          ) : null}
          {application.conversationId ? (
            <Link
              className="button button-secondary"
              to={`/espace/messages?conversation=${application.conversationId}`}
            >
              Ouvrir la conversation
            </Link>
          ) : null}
        </div>
      </Card>
    );
  };

  return (
    <div className="applications-list-panel">
      <div className="application-filters">
        <label>
          <span>Rechercher</span>
          <span className="control-shell">
            <Input
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder="Mission, message ou profil"
              type="search"
              value={query}
            />
            <Search aria-hidden="true" className="control-icon" size={18} />
          </span>
        </label>
        <label>
          <span>Statut</span>
          <Select
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as ApplicationStatus | '');
            }}
            value={status}
          >
            <option value="">Tous</option>
            {[
              'submitted',
              'viewed',
              'shortlisted',
              'accepted',
              'rejected',
              'withdrawn',
            ].map((item) => (
              <option key={item} value={item}>
                {formatApplicationStatus(item as ApplicationStatus)}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span>Trier par</span>
          <Select
            onChange={(event) => {
              setPage(1);
              setSort(event.target.value as ApplicationFilters['sort']);
            }}
            value={sort}
          >
            <option value="newest">Plus récent</option>
            {scope === 'received' ? (
              <>
                <option value="score_desc">Pertinence</option>
                <option value="availability">Disponibilité</option>
                <option value="proposal_asc">Proposition croissante</option>
                <option value="proposal_desc">Proposition décroissante</option>
                <option value="reputation">Note réelle</option>
                <option value="experience">Expérience déclarée</option>
              </>
            ) : null}
          </Select>
        </label>
      </div>
      {scope === 'received' ? (
        <p className="distance-limit-note">
          Aucun tri par distance n’est proposé : le projet ne dispose pas de
          coordonnées publiques suffisamment précises. Les missions remote
          n’utilisent jamais la distance.
        </p>
      ) : null}
      {actionError ? (
        <p className="field-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {scope === 'received' && compared.length >= 2 ? (
        <section
          className="comparison-panel"
          aria-labelledby="comparison-title"
        >
          <div className="comparison-heading">
            <div>
              <p className="eyebrow">Deux ou trois profils maximum</p>
              <h2 id="comparison-title">Comparaison</h2>
            </div>
            <Button
              isLoading={undoMutation.isPending}
              onClick={() => undoMutation.mutate()}
              variant="secondary"
            >
              <RotateCcw aria-hidden="true" size={18} /> Annuler la dernière
              décision
            </Button>
          </div>
          <div className="comparison-grid">
            {compared.slice(0, 3).map((application) => (
              <Card key={application.id}>
                <h3>{application.applicant.displayName}</h3>
                <strong>
                  Pertinence {Math.round(application.relevanceScore)}/100
                </strong>
                <p>{application.availabilityNote}</p>
                <p>{formatProposal(application)}</p>
                <p>
                  {application.applicant.reviewCount
                    ? `${application.applicant.reputation?.toFixed(1)}/5 · ${application.applicant.reviewCount} avis`
                    : 'Nouveau profil · aucun avis'}
                </p>
                <p>
                  {application.applicant.experienceYears} an(s) d’expérience
                  déclarée
                </p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
      {!items.length ? (
        <EmptyState
          description={
            scope === 'received'
              ? 'Aucune candidature réelle ne correspond à ces critères.'
              : 'Candidatez depuis une mission ouverte pour suivre son statut ici.'
          }
          icon={<UserRoundSearch />}
          title="Aucune candidature"
        />
      ) : scope === 'received' ? (
        <div className="received-groups">
          {Array.from(grouped.entries()).map(([missionId, applications]) => (
            <section key={missionId}>
              <header>
                <div>
                  <h2>{applications[0]?.mission.title}</h2>
                  <p>{applications.length} candidature(s) sur cette page</p>
                </div>
                <Link to={`/espace/missions/${missionId}`}>
                  Voir la mission
                </Link>
              </header>
              <div className="application-grid">{applications.map(card)}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="application-grid">{items.map(card)}</div>
      )}
      {items.length ? (
        <Pagination
          currentPage={page}
          disabled={applicationsQuery.isFetching}
          onPageChange={setPage}
          totalPages={totalPages}
        />
      ) : null}
    </div>
  );
}

export function ApplicationsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('vue');
  const scope = requested === 'recues' ? 'received' : 'talent';
  return (
    <section className="applications-page">
      <header className="applications-heading">
        <div>
          <p className="eyebrow">Suivi persistant</p>
          <h1>Candidatures</h1>
          <p>
            Consultez les statuts réels, comparez des critères utiles et gardez
            la décision finale manuelle.
          </p>
        </div>
        <Link className="button button-secondary" to="/espace/swipe">
          Mode cartes secondaire
        </Link>
      </header>
      <Tabs
        items={[
          {
            content:
              scope === 'talent' ? <ApplicationList scope="talent" /> : null,
            label: 'Envoyées',
            value: 'talent',
          },
          {
            content:
              scope === 'received' ? (
                <ApplicationList scope="received" />
              ) : null,
            label: 'Reçues',
            value: 'received',
          },
        ]}
        label="Type de candidatures"
        onValueChange={(value) =>
          setParams(value === 'received' ? { vue: 'recues' } : {}, {
            replace: true,
          })
        }
        value={scope}
      />
    </section>
  );
}

export { activeStatuses };
