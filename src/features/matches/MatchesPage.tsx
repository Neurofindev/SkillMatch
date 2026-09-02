import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Handshake, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui';
import {
  getFrenchMatchError,
  listMatches,
  matchQueryKeys,
} from '@/features/matches/matchApi';
import { getAvatarPublicUrl } from '@/features/profiles/avatar';
import { getSupabaseClient } from '@/lib/supabase/client';

const statuses = {
  active: 'Collaboration active',
  cancelled: 'Annulée',
  completed: 'Terminée',
} as const;

export function MatchesPage() {
  const client = getSupabaseClient();
  const matchesQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => listMatches(client!),
    queryKey: matchQueryKeys.list,
  });

  if (matchesQuery.isLoading) {
    return <Skeleton label="Chargement des collaborations" lines={8} />;
  }
  if (matchesQuery.isError) {
    return (
      <ErrorState
        action={{
          label: 'Réessayer',
          onClick: () => void matchesQuery.refetch(),
        }}
        description={getFrenchMatchError(matchesQuery.error)}
        title="Les collaborations ne peuvent pas être chargées"
      />
    );
  }

  const matches = matchesQuery.data ?? [];
  return (
    <section className="matches-page">
      <header className="applications-heading">
        <div>
          <p className="eyebrow">Données persistées</p>
          <h1>Suivi des missions</h1>
          <p>
            Retrouvez l’accord, les confirmations et la chronologie partagée de
            chaque collaboration réelle.
          </p>
        </div>
      </header>
      {!matches.length ? (
        <EmptyState
          description="Un suivi apparaîtra lorsqu’une candidature aura réellement été acceptée."
          icon={<Handshake />}
          title="Aucune collaboration"
        />
      ) : (
        <div className="match-list-grid">
          {matches.map((match) => {
            const avatarUrl = client
              ? getAvatarPublicUrl(client, match.counterpart.avatarPath)
              : undefined;
            return (
              <Card className="match-list-card" key={match.id}>
                <div className="match-card-heading">
                  <Badge>{statuses[match.status]}</Badge>
                  <span>
                    {match.role === 'client'
                      ? 'Vous êtes client'
                      : 'Vous êtes talent'}
                  </span>
                </div>
                <h2>{match.mission.title}</h2>
                <div className="application-public-person">
                  <Avatar
                    name={match.counterpart.displayName}
                    size="sm"
                    {...(avatarUrl ? { src: avatarUrl } : {})}
                  />
                  <div>
                    <strong>{match.counterpart.displayName}</strong>
                    <span>@{match.counterpart.username}</span>
                  </div>
                </div>
                <p>
                  {match.counterpart.headline ?? (
                    <span>
                      <UserRound aria-hidden="true" size={16} /> Profil public
                      minimal
                    </span>
                  )}
                </p>
                <p className="match-agreement-state">
                  Accord : {match.agreementStatus ?? 'indisponible'}
                </p>
                <Link
                  className="button button-primary"
                  to={`/espace/matches/${match.id}`}
                >
                  Ouvrir le suivi <ArrowRight aria-hidden="true" size={18} />
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
