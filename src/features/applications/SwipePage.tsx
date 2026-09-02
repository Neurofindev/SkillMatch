import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, RotateCcw, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
} from '@/components/ui';
import { AccessibleSwipeCard } from '@/features/applications/AccessibleSwipeCard';
import {
  applicationQueryKeys,
  getFrenchApplicationError,
  listApplications,
  recordApplicationSwipe,
  recordMissionSwipe,
  undoLastApplicationSwipe,
  undoLastMissionSwipe,
} from '@/features/applications/applicationApi';
import { RelevanceScore } from '@/features/applications/RelevanceScore';
import {
  formatApplicationStatus,
  formatProposal,
} from '@/features/applications/applicationView';
import { searchMissions } from '@/features/missions/missionApi';
import {
  formatMissionBudget,
  getMissionLocation,
} from '@/features/missions/missionView';
import { getSupabaseClient } from '@/lib/supabase/client';

function TalentSwipeDeck() {
  const auth = useAuth();
  const client = getSupabaseClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deckQuery = useQuery({
    enabled: Boolean(client && auth.user),
    queryFn: async () => {
      const [missions, swipes] = await Promise.all([
        searchMissions(client!, {
          page: 1,
          pageSize: 24,
          requiredLevels: [],
          skillIds: [],
          sort: 'relevance',
          workModes: [],
        }),
        client!
          .from('swipes')
          .select('target_mission_id')
          .eq('author_id', auth.user!.id)
          .eq('target_type', 'mission'),
      ]);
      if (swipes.error) throw swipes.error;
      const decided = new Set(
        (swipes.data ?? [])
          .map((row) => row.target_mission_id)
          .filter((id): id is string => Boolean(id)),
      );
      return missions.items.filter(
        (mission) =>
          mission.owner.id !== auth.user!.id &&
          !mission.isFavorite &&
          !decided.has(mission.id),
      );
    },
    queryKey: applicationQueryKeys.swipeDeck('talent'),
  });
  const actionMutation = useMutation({
    mutationFn: async ({
      decision,
      missionId,
    }: {
      decision: 'interested' | 'pass' | 'save';
      missionId: string;
    }) => {
      if (!client) throw new Error('AUTH_REQUIRED');
      await recordMissionSwipe(client, missionId, decision);
      return { decision, missionId };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.swipeDeck('talent'),
      });
    },
  });
  const undoMutation = useMutation({
    mutationFn: () => undoLastMissionSwipe(client!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.swipeDeck('talent'),
      });
    },
  });

  if (deckQuery.isLoading)
    return <Skeleton label="Chargement des missions" lines={8} />;
  if (deckQuery.isError || actionMutation.isError || undoMutation.isError) {
    const error = deckQuery.error ?? actionMutation.error ?? undoMutation.error;
    return (
      <ErrorState
        action={{ label: 'Réessayer', onClick: () => void deckQuery.refetch() }}
        description={getFrenchApplicationError(error)}
        title="Le mode cartes est indisponible"
      />
    );
  }
  const mission = deckQuery.data?.[0];
  if (!mission) {
    return (
      <EmptyState
        action={{
          label: 'Annuler la dernière décision',
          onClick: () => undoMutation.mutate(),
        }}
        description="Toutes les missions de cette sélection ont reçu une décision. La liste de découverte reste disponible."
        title="Aucune autre carte"
      />
    );
  }

  const decide = (decision: 'interested' | 'pass' | 'save') =>
    actionMutation.mutate({ decision, missionId: mission.id });
  const openApplication = () => {
    actionMutation.mutate(
      { decision: 'interested', missionId: mission.id },
      {
        onSuccess: () => navigate(`/espace/missions/${mission.id}/candidature`),
      },
    );
  };

  return (
    <div className="swipe-deck-panel">
      <div className="swipe-toolbar">
        <p>
          {deckQuery.data?.length ?? 0} mission(s) restant dans cette sélection
        </p>
        <Button onClick={() => undoMutation.mutate()} variant="secondary">
          <RotateCcw aria-hidden="true" size={18} /> Annuler la dernière
          décision
        </Button>
      </div>
      <AccessibleSwipeCard
        leftAction={{ label: 'Passer', onAction: () => decide('pass') }}
        onOpen={openApplication}
        openLabel="Ouvrir la candidature"
        rightAction={{ label: 'Enregistrer', onAction: () => decide('save') }}
      >
        <Card className="swipe-content-card">
          <div className="mission-badges">
            <Badge tone="primary">{mission.category}</Badge>
            <Badge>
              {mission.workMode === 'remote'
                ? 'À distance'
                : mission.workMode === 'hybrid'
                  ? 'Hybride'
                  : 'Sur place'}
            </Badge>
          </div>
          <h2>{mission.title}</h2>
          <p>{mission.description}</p>
          <ul className="mission-facts">
            <li>{getMissionLocation(mission)}</li>
            <li>{formatMissionBudget(mission)}</li>
          </ul>
          <ul className="mission-skills">
            {mission.skills.slice(0, 5).map((skill) => (
              <li key={skill.id}>{skill.name}</li>
            ))}
          </ul>
          <p className="swipe-safety-copy">
            <Heart aria-hidden="true" size={17} /> Enregistrer crée un favori.
            Ouvrir ne candidate jamais automatiquement.
          </p>
        </Card>
      </AccessibleSwipeCard>
    </div>
  );
}

function ClientSwipeDeck() {
  const client = getSupabaseClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deckQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () =>
      listApplications(client!, {
        page: 1,
        pageSize: 50,
        scope: 'received',
        sort: 'score_desc',
        statuses: ['submitted', 'viewed', 'shortlisted'],
      }),
    queryKey: applicationQueryKeys.swipeDeck('client'),
    select: (result) => ({
      ...result,
      items: result.items.filter((item) => item.swipeDecision === null),
    }),
  });
  const actionMutation = useMutation({
    mutationFn: async (decision: 'compare' | 'pass' | 'shortlist') => {
      const application = deckQuery.data?.items[0];
      if (!client || !application) throw new Error('APPLICATION_NOT_FOUND');
      await recordApplicationSwipe(client, application, decision);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.all,
      });
    },
  });
  const undoMutation = useMutation({
    mutationFn: () => undoLastApplicationSwipe(client!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.all,
      });
    },
  });

  if (deckQuery.isLoading)
    return <Skeleton label="Chargement des candidatures" lines={8} />;
  if (deckQuery.isError || actionMutation.isError || undoMutation.isError) {
    const error = deckQuery.error ?? actionMutation.error ?? undoMutation.error;
    return (
      <ErrorState
        action={{ label: 'Réessayer', onClick: () => void deckQuery.refetch() }}
        description={getFrenchApplicationError(error)}
        title="Le mode cartes est indisponible"
      />
    );
  }
  const application = deckQuery.data?.items[0];
  if (!application) {
    return (
      <EmptyState
        action={{
          label: 'Annuler la dernière décision réversible',
          onClick: () => undoMutation.mutate(),
        }}
        description="Seules les candidatures réellement reçues apparaissent ici. Consultez la vue liste pour les retrouver toutes."
        title="Aucune carte reçue"
      />
    );
  }

  return (
    <div className="swipe-deck-panel">
      <div className="swipe-toolbar">
        <p>{deckQuery.data?.items.length ?? 0} candidature(s) à examiner</p>
        <Button onClick={() => undoMutation.mutate()} variant="secondary">
          <RotateCcw aria-hidden="true" size={18} /> Annuler la dernière
          décision
        </Button>
      </div>
      <AccessibleSwipeCard
        leftAction={{
          label: 'Passer',
          onAction: () => actionMutation.mutate('pass'),
        }}
        middleAction={{
          label: 'Comparer',
          onAction: () => actionMutation.mutate('compare'),
        }}
        onOpen={() => navigate(`/espace/candidatures/${application.id}`)}
        openLabel="Ouvrir le profil et la candidature"
        rightAction={{
          label: 'Présélectionner',
          onAction: () => actionMutation.mutate('shortlist'),
        }}
      >
        <Card className="swipe-content-card">
          <div className="mission-badges">
            <Badge tone="primary">{application.mission.title}</Badge>
            <Badge>{formatApplicationStatus(application.status)}</Badge>
          </div>
          <h2>{application.applicant.displayName}</h2>
          <p>
            {application.applicant.headline ??
              `@${application.applicant.username}`}
          </p>
          <RelevanceScore compact details={application.relevance} />
          <p>{application.availabilityNote}</p>
          <p>{formatProposal(application)}</p>
          <p className="swipe-safety-copy">
            <Sparkles aria-hidden="true" size={17} /> Passer ne refuse pas. Un
            refus reste une action confirmée dans la vue liste.
          </p>
        </Card>
      </AccessibleSwipeCard>
    </div>
  );
}

export function SwipePage() {
  const [params, setParams] = useSearchParams();
  const scope = params.get('vue') === 'client' ? 'client' : 'talent';
  return (
    <section className="swipe-page">
      <header>
        <p className="eyebrow">Interface secondaire</p>
        <h1>Mode cartes</h1>
        <p>
          Chaque geste possède un bouton et un raccourci clavier. La vue liste
          reste la référence complète.
        </p>
      </header>
      <Tabs
        items={[
          {
            content: scope === 'talent' ? <TalentSwipeDeck /> : null,
            label: 'Missions pour moi',
            value: 'talent',
          },
          {
            content: scope === 'client' ? <ClientSwipeDeck /> : null,
            label: 'Candidatures reçues',
            value: 'client',
          },
        ]}
        label="Type de cartes"
        onValueChange={(value) =>
          setParams(value === 'client' ? { vue: 'client' } : {}, {
            replace: true,
          })
        }
        value={scope}
      />
    </section>
  );
}
