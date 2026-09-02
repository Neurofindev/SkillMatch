import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Star } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
} from '@/components/ui';
import { getAvatarPublicUrl } from '@/features/profiles/avatar';
import {
  getFrenchReviewError,
  getReputationSummary,
  listReceivedReviews,
  listReviewOpportunities,
  reviewQueryKeys,
} from '@/features/reviews/reviewApi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getSupabaseClient } from '@/lib/supabase/client';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
  }).format(new Date(value));
}

export function ReviewsPage() {
  useDocumentTitle('Mes avis');
  const client = getSupabaseClient();
  const navigate = useNavigate();
  const userId = useAuth().user?.id ?? '';
  const [page, setPage] = useState(1);
  const opportunitiesQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => listReviewOpportunities(client!),
    queryKey: reviewQueryKeys.opportunities,
  });
  const reputationQuery = useQuery({
    enabled: Boolean(client && userId),
    queryFn: () => getReputationSummary(client!, userId),
    queryKey: reviewQueryKeys.reputation(userId),
  });
  const receivedQuery = useQuery({
    enabled: Boolean(client && userId),
    queryFn: () => listReceivedReviews(client!, userId, page),
    queryKey: reviewQueryKeys.received(userId, page),
  });

  if (
    opportunitiesQuery.isLoading ||
    reputationQuery.isLoading ||
    receivedQuery.isLoading
  ) {
    return <Skeleton label="Chargement des avis vérifiés" lines={10} />;
  }
  const error =
    opportunitiesQuery.error ?? reputationQuery.error ?? receivedQuery.error;
  if (error) {
    return (
      <ErrorState
        action={{
          label: 'Réessayer',
          onClick: () => {
            void opportunitiesQuery.refetch();
            void reputationQuery.refetch();
            void receivedQuery.refetch();
          },
        }}
        description={getFrenchReviewError(error)}
        title="Avis indisponibles"
      />
    );
  }

  const opportunities = opportunitiesQuery.data ?? [];
  const reviewsToLeave = opportunities.filter(
    ({ ownReviewId }) => !ownReviewId,
  );
  const reputation = reputationQuery.data;
  const received = receivedQuery.data;
  const totalPages = Math.max(1, Math.ceil((received?.total ?? 0) / 10));

  return (
    <section className="reviews-page">
      <header className="applications-heading">
        <div>
          <p className="eyebrow">Missions clôturées uniquement</p>
          <h1>Avis et réputation</h1>
          <p>
            Chaque avis est relié à une collaboration terminée. Un nouveau
            profil reste neutre tant qu’il n’a reçu aucun avis.
          </p>
        </div>
      </header>

      <div className="reputation-overview">
        <Card>
          {reputation && !reputation.isNewProfile ? (
            <>
              <p className="eyebrow">Réputation vérifiée</p>
              <p className="reputation-score">
                <Star aria-hidden="true" fill="currentColor" size={24} />
                <strong>{reputation.averageRating}/5</strong>
              </p>
              <p>
                {reputation.reviewCount} avis · {reputation.completedMissions}{' '}
                mission
                {reputation.completedMissions > 1 ? 's' : ''} terminée
                {reputation.completedMissions > 1 ? 's' : ''}
              </p>
            </>
          ) : (
            <EmptyState
              description="Aucune note par défaut n’est attribuée. Votre réputation apparaîtra avec son nombre d’avis réel."
              title="Nouveau profil"
            />
          )}
        </Card>
        <Card>
          <p className="eyebrow">Distribution</p>
          <h2>Notes reçues</h2>
          {reputation && reputation.reviewCount > 0 ? (
            <dl className="rating-distribution">
              {([5, 4, 3, 2, 1] as const).map((rating) => (
                <div key={rating}>
                  <dt>{rating}/5</dt>
                  <dd>{reputation.distribution[rating]}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="inline-empty">Aucune note à répartir.</p>
          )}
        </Card>
      </div>

      <section aria-labelledby="reviews-to-leave-title">
        <div className="section-heading compact">
          <p className="eyebrow">Prochaine action</p>
          <h2 id="reviews-to-leave-title">Avis à laisser</h2>
        </div>
        {reviewsToLeave.length ? (
          <div className="review-opportunity-list">
            {reviewsToLeave.map((opportunity) => {
              const avatarUrl = client
                ? getAvatarPublicUrl(client, opportunity.counterpart.avatarPath)
                : undefined;
              return (
                <Card
                  className="review-opportunity-card"
                  key={opportunity.matchId}
                >
                  <div className="review-opportunity-person">
                    <Avatar
                      name={opportunity.counterpart.displayName}
                      {...(avatarUrl ? { src: avatarUrl } : {})}
                    />
                    <div>
                      <h3>{opportunity.counterpart.displayName}</h3>
                      <p>@{opportunity.counterpart.username}</p>
                    </div>
                  </div>
                  <div>
                    <strong>{opportunity.missionTitle}</strong>
                    <p>
                      Terminée le {formatDate(opportunity.completedAt)} ·{' '}
                      {opportunity.role === 'client'
                        ? 'vous étiez client'
                        : 'vous étiez talent'}
                    </p>
                  </div>
                  <Link
                    className="button button-primary"
                    to={`/espace/avis/${opportunity.matchId}`}
                  >
                    Laisser mon avis
                  </Link>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            action={{
              label: 'Voir mes suivis',
              onClick: () => navigate('/espace/matches'),
            }}
            description="Vous n’avez aucun avis en attente sur une mission terminée."
            icon={<CheckCircle2 />}
            title="Tout est à jour"
          />
        )}
      </section>

      <section aria-labelledby="received-reviews-title">
        <div className="section-heading compact">
          <p className="eyebrow">Historique réel</p>
          <h2 id="received-reviews-title">Avis reçus</h2>
        </div>
        {received?.items.length ? (
          <>
            <div className="received-review-list">
              {received.items.map((review) => (
                <Card className="received-review-card" key={review.id}>
                  <div className="received-review-heading">
                    <div>
                      <Badge tone="success">Mission vérifiée</Badge>
                      <h3>{review.mission.title}</h3>
                    </div>
                    <span
                      className="review-rating"
                      aria-label={`${review.rating} sur 5`}
                    >
                      <Star aria-hidden="true" fill="currentColor" size={18} />{' '}
                      {review.rating}/5
                    </span>
                  </div>
                  <p>{review.comment || 'Aucun commentaire.'}</p>
                  {review.criteria ? (
                    <dl className="review-criteria-summary">
                      <div>
                        <dt>Communication</dt>
                        <dd>{review.criteria.communication}/5</dd>
                      </div>
                      <div>
                        <dt>Fiabilité</dt>
                        <dd>{review.criteria.reliability}/5</dd>
                      </div>
                      <div>
                        <dt>Qualité</dt>
                        <dd>{review.criteria.quality}/5</dd>
                      </div>
                    </dl>
                  ) : null}
                  <footer>
                    <span>
                      Par {review.author.displayName} (@{review.author.username}
                      )
                    </span>
                    <span>
                      <Clock3 aria-hidden="true" size={15} />{' '}
                      {formatDate(review.createdAt)}
                    </span>
                  </footer>
                </Card>
              ))}
            </div>
            {totalPages > 1 ? (
              <Pagination
                currentPage={page}
                onPageChange={setPage}
                totalPages={totalPages}
              />
            ) : null}
          </>
        ) : (
          <EmptyState
            description="Les avis reçus apparaîtront ici après la clôture réelle d’une mission."
            title="Aucun avis reçu"
          />
        )}
      </section>
    </section>
  );
}
