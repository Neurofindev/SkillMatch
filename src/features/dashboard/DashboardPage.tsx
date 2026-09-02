import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileUser,
  MessageCircle,
  Star,
  Trophy,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui';
import {
  dashboardQueryKeys,
  getDashboardOverview,
  getFrenchDashboardError,
  getWeeklyRanking,
  listDashboardDeadlines,
} from '@/features/dashboard/dashboardApi';
import { getAvatarPublicUrl } from '@/features/profiles/avatar';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getSupabaseClient } from '@/lib/supabase/client';

const missingFieldLabels: Record<string, string> = {
  availability: 'disponibilité',
  bio: 'bio',
  headline: 'accroche',
  onboarding: 'onboarding',
  skills: 'compétences',
};

function formatDeadline(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function DashboardPage() {
  useDocumentTitle('Tableau de bord');
  const client = getSupabaseClient();
  const navigate = useNavigate();
  const overviewQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => getDashboardOverview(client!),
    queryKey: dashboardQueryKeys.overview,
  });
  const deadlinesQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => listDashboardDeadlines(client!),
    queryKey: dashboardQueryKeys.deadlines,
  });
  const rankingQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => getWeeklyRanking(client!),
    queryKey: dashboardQueryKeys.ranking,
  });

  if (overviewQuery.isLoading) {
    return <Skeleton label="Calcul du tableau de bord" lines={12} />;
  }
  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <ErrorState
        action={{
          label: 'Réessayer',
          onClick: () => void overviewQuery.refetch(),
        }}
        description={getFrenchDashboardError()}
        title="Tableau de bord indisponible"
      />
    );
  }

  const overview = overviewQuery.data;
  const actionCount =
    overview.agreementsToConfirm +
    overview.reviewsToLeave +
    overview.unreadMessages +
    (overview.profileMissingFields.length ? 1 : 0);

  return (
    <section className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Votre activité réelle</p>
          <h1>Tableau de bord</h1>
          <p>
            Les compteurs proviennent de vos missions, candidatures, accords,
            messages et avis persistés.
          </p>
        </div>
        <Badge tone={actionCount ? 'warning' : 'success'}>
          {actionCount
            ? `${actionCount} action${actionCount > 1 ? 's' : ''} utile${actionCount > 1 ? 's' : ''}`
            : 'À jour'}
        </Badge>
      </header>

      <section aria-labelledby="next-actions-title">
        <div className="section-heading compact">
          <p className="eyebrow">Priorités</p>
          <h2 id="next-actions-title">Prochaines actions</h2>
        </div>
        <div className="dashboard-action-grid">
          {overview.profileMissingFields.length ? (
            <Card className="dashboard-action-card">
              <ClipboardCheck aria-hidden="true" />
              <div>
                <h3>Compléter le profil</h3>
                <p>
                  À renseigner :{' '}
                  {overview.profileMissingFields
                    .map((field) => missingFieldLabels[field] ?? field)
                    .join(', ')}
                  .
                </p>
              </div>
              <Link to="/espace/profil">
                Modifier <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </Card>
          ) : null}
          {overview.agreementsToConfirm ? (
            <Card className="dashboard-action-card">
              <CheckCircle2 aria-hidden="true" />
              <div>
                <h3>Accords à confirmer</h3>
                <p>{overview.agreementsToConfirm} confirmation en attente.</p>
              </div>
              <Link to="/espace/matches">Voir les suivis</Link>
            </Card>
          ) : null}
          {overview.unreadMessages ? (
            <Card className="dashboard-action-card">
              <MessageCircle aria-hidden="true" />
              <div>
                <h3>Messages non lus</h3>
                <p>{overview.unreadMessages} message non lu.</p>
              </div>
              <Link to="/espace/messages">Ouvrir les messages</Link>
            </Card>
          ) : null}
          {overview.reviewsToLeave ? (
            <Card className="dashboard-action-card">
              <Star aria-hidden="true" />
              <div>
                <h3>Avis à laisser</h3>
                <p>{overview.reviewsToLeave} mission terminée à évaluer.</p>
              </div>
              <Link to="/espace/avis">Voir les avis</Link>
            </Card>
          ) : null}
          {!actionCount ? (
            <EmptyState
              action={{
                label: overview.canWork
                  ? 'Découvrir des missions'
                  : 'Publier une mission',
                onClick: () =>
                  navigate(
                    overview.canWork
                      ? '/espace/decouvrir'
                      : '/espace/missions/nouvelle',
                  ),
              }}
              description="Aucune action prioritaire n’est issue de vos données actuelles."
              icon={<CheckCircle2 />}
              title="Tout est à jour"
            />
          ) : null}
        </div>
      </section>

      <section aria-labelledby="activity-title">
        <div className="section-heading compact">
          <p className="eyebrow">Selon vos capacités</p>
          <h2 id="activity-title">Activité</h2>
        </div>
        <div className="dashboard-metric-grid">
          {overview.canWork ? (
            <Card>
              <FileUser aria-hidden="true" />
              <strong>{overview.pendingApplications}</strong>
              <span>Candidatures talent en attente</span>
              <strong>{overview.talentActiveMissions}</strong>
              <span>Missions actives comme talent</span>
              <Link to="/espace/candidatures">Mes candidatures</Link>
            </Card>
          ) : null}
          {overview.canHire ? (
            <Card>
              <ClipboardCheck aria-hidden="true" />
              <strong>{overview.clientActiveMissions}</strong>
              <span>Missions actives comme client</span>
              <Link to="/espace/missions">Mes missions</Link>
            </Card>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="deadlines-title">
        <div className="section-heading compact">
          <p className="eyebrow">Dates de vos accords</p>
          <h2 id="deadlines-title">Échéances à venir</h2>
        </div>
        {deadlinesQuery.isLoading ? (
          <Skeleton label="Chargement des échéances" lines={4} />
        ) : deadlinesQuery.isError ? (
          <ErrorState
            action={{
              label: 'Réessayer',
              onClick: () => void deadlinesQuery.refetch(),
            }}
            description={getFrenchDashboardError()}
            title="Échéances indisponibles"
          />
        ) : deadlinesQuery.data?.length ? (
          <div className="dashboard-deadline-list">
            {deadlinesQuery.data.map((deadline) => (
              <Card key={deadline.matchId}>
                <CalendarClock aria-hidden="true" />
                <div>
                  <h3>{deadline.missionTitle}</h3>
                  <p>
                    {deadline.role === 'client' ? 'Côté client' : 'Côté talent'}{' '}
                    · fin prévue le {formatDeadline(deadline.endsOn)}
                  </p>
                </div>
                <Link to={deadline.internalPath}>Ouvrir le suivi</Link>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            description="Aucun accord actif avec une échéance future n’est enregistré."
            title="Aucune échéance à venir"
          />
        )}
      </section>

      <section aria-labelledby="weekly-ranking-title">
        <div className="section-heading compact">
          <p className="eyebrow">Fenêtre glissante de 7 jours</p>
          <h2 id="weekly-ranking-title">Top de la semaine</h2>
          <p>
            Classement d’activité par missions réellement terminées. Il mesure
            l’activité, pas la qualité ni la fiabilité future.
          </p>
        </div>
        {rankingQuery.isLoading ? (
          <Skeleton label="Calcul du classement" lines={5} />
        ) : rankingQuery.isError || !rankingQuery.data ? (
          <ErrorState
            action={{
              label: 'Réessayer',
              onClick: () => void rankingQuery.refetch(),
            }}
            description={getFrenchDashboardError()}
            title="Classement indisponible"
          />
        ) : !rankingQuery.data.sufficientData ? (
          <Card className="ranking-insufficient-card">
            <Trophy aria-hidden="true" size={28} />
            <div>
              <h3>Données insuffisantes</h3>
              <p>
                {rankingQuery.data.sampleCompletedMissions} mission
                {rankingQuery.data.sampleCompletedMissions > 1 ? 's' : ''}{' '}
                terminée
                {rankingQuery.data.sampleCompletedMissions > 1
                  ? 's'
                  : ''} par {rankingQuery.data.sampleProfiles} talent
                {rankingQuery.data.sampleProfiles > 1 ? 's' : ''}. Minimum :{' '}
                {rankingQuery.data.minimumCompletedMissions} missions et{' '}
                {rankingQuery.data.minimumProfiles} talents distincts.
              </p>
            </div>
          </Card>
        ) : (
          <ol className="weekly-ranking-list">
            {rankingQuery.data.items.map((item) => {
              const avatarUrl = client
                ? getAvatarPublicUrl(client, item.avatarPath)
                : undefined;
              return (
                <li key={item.profileId}>
                  <Card>
                    <strong className="ranking-position">
                      #{item.rankPosition}
                    </strong>
                    <Avatar
                      name={item.displayName}
                      {...(avatarUrl ? { src: avatarUrl } : {})}
                    />
                    <div>
                      <h3>{item.displayName}</h3>
                      <p>@{item.username}</p>
                    </div>
                    <p>
                      <strong>{item.weeklyCompletions}</strong> mission
                      {item.weeklyCompletions > 1 ? 's' : ''} terminée
                      {item.weeklyCompletions > 1 ? 's' : ''}
                    </p>
                    <p>
                      {item.reviewCount && item.averageRating !== null
                        ? `${item.averageRating}/5 · ${item.reviewCount} avis`
                        : 'Nouveau profil · aucun avis'}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </section>
  );
}
