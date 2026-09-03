import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  Heart,
  Info,
  MapPin,
  Pencil,
  Share2,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/FeedbackStates';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { getApplicationEligibility } from '@/features/applications/applicationEligibility';
import {
  getFrenchMissionError,
  missionQueryKeys,
  searchMissions,
  setFavorite,
} from '@/features/missions/missionApi';
import {
  formatMissionBudget,
  formatMissionDate,
  formatMissionStatus,
  formatSkillLevel,
  getMissionLocation,
} from '@/features/missions/missionView';
import { getAvatarPublicUrl } from '@/features/profiles/avatar';
import { ReportDialog } from '@/features/safety/ReportDialog';
import {
  getFrenchSafetyError,
  setProfileBlock,
} from '@/features/safety/safetyApi';
import { getSupabaseClient } from '@/lib/supabase/client';

export function MissionDetailPage() {
  const { missionId = '' } = useParams();
  const auth = useAuth();
  const client = getSupabaseClient();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
  const mission = missionQuery.data?.items[0];

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (!client || !auth.user || !mission) throw new Error('AUTH_REQUIRED');
      await setFavorite(client, auth.user.id, mission.id, !mission.isFavorite);
    },
    onError: (error) =>
      notify({
        description: getFrenchMissionError(error),
        title: 'Favori non enregistré',
        tone: 'danger',
      }),
    onSuccess: async () => {
      notify({
        title: mission?.isFavorite
          ? 'Mission retirée des favoris'
          : 'Mission ajoutée aux favoris',
        tone: 'success',
      });
      await queryClient.invalidateQueries({ queryKey: missionQueryKeys.all });
    },
  });
  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!client || !mission) throw new Error('SUPABASE_UNAVAILABLE');
      await setProfileBlock(client, mission.owner.id, true);
    },
    onError: (error) =>
      notify({
        description: getFrenchSafetyError(error),
        title: 'Blocage impossible',
        tone: 'danger',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: missionQueryKeys.all });
      notify({
        description:
          'Ses missions disparaissent de votre découverte et toute nouvelle interaction est refusée côté base.',
        title: 'Profil bloqué',
        tone: 'success',
      });
      navigate('/espace/decouvrir');
    },
  });

  const share = async () => {
    if (!mission) return;
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: mission.title, url });
      else await navigator.clipboard.writeText(url);
      notify({
        title: 'Lien de la mission prêt à être partagé',
        tone: 'success',
      });
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        notify({ title: 'Le lien n’a pas pu être copié', tone: 'danger' });
      }
    }
  };

  if (missionQuery.isLoading) {
    return (
      <section className="mission-detail-page">
        <Skeleton label="Chargement de la mission" lines={9} />
      </section>
    );
  }
  if (missionQuery.isError) {
    return (
      <ErrorState
        action={{
          label: 'Réessayer',
          onClick: () => void missionQuery.refetch(),
        }}
        description={getFrenchMissionError(missionQuery.error)}
        title="La mission ne peut pas être chargée"
      />
    );
  }
  if (!mission) {
    return (
      <EmptyState
        description="Cette mission n’existe pas, n’est plus visible ou ne vous est pas accessible."
        title="Mission introuvable"
      />
    );
  }

  const isOwner = mission.owner.id === auth.user?.id;
  const applicationEligibility = getApplicationEligibility(mission, {
    canWork: Boolean(auth.profile?.canWork),
    id: auth.user?.id ?? '',
  });
  const avatarUrl = client
    ? getAvatarPublicUrl(client, mission.owner.avatarPath)
    : undefined;

  return (
    <section className="mission-detail-page">
      <Link className="back-link" to="/espace/decouvrir">
        <ArrowLeft aria-hidden="true" size={18} /> Retour aux missions
      </Link>

      <header className="mission-detail-heading">
        <div>
          <div className="mission-badges">
            <Badge tone="primary">{mission.category}</Badge>
            <Badge>{formatMissionStatus(mission.status)}</Badge>
          </div>
          <h1>{mission.title}</h1>
          <p>{getMissionLocation(mission)}</p>
        </div>
        <div className="mission-detail-actions">
          {!isOwner ? (
            <Button
              isLoading={favoriteMutation.isPending}
              onClick={() => favoriteMutation.mutate()}
              variant="secondary"
            >
              <Heart
                aria-hidden="true"
                fill={mission.isFavorite ? 'currentColor' : 'none'}
              />
              {mission.isFavorite
                ? 'Retirer des favoris'
                : 'Ajouter aux favoris'}
            </Button>
          ) : null}
          {applicationEligibility.allowed ? (
            <Link
              className="button button-primary"
              to={`/espace/missions/${mission.id}/candidature`}
            >
              <Send aria-hidden="true" size={18} /> Candidater
            </Link>
          ) : null}
          {applicationEligibility.reason === 'work-capability-required' ? (
            <Link
              className="button button-primary"
              to="/espace/profil#capacites"
            >
              Activer « trouver une mission »
            </Link>
          ) : null}
          <Button onClick={() => void share()} variant="secondary">
            <Share2 aria-hidden="true" size={18} /> Partager
          </Button>
          {!isOwner ? (
            <ReportDialog
              label="Signaler la mission"
              targetId={mission.id}
              targetLabel="cette mission"
              targetType="mission"
            />
          ) : null}
          {isOwner &&
          ['draft', 'published', 'selecting'].includes(mission.status) ? (
            <Link
              className="button button-primary"
              to={`/espace/missions/${mission.id}/modifier`}
            >
              <Pencil aria-hidden="true" size={18} /> Modifier
            </Link>
          ) : null}
        </div>
      </header>

      <div className="mission-detail-layout">
        <div className="mission-detail-main">
          <Card>
            <h2>Le besoin</h2>
            <p className="mission-description-full">{mission.description}</p>
          </Card>

          <Card>
            <h2>Compétences et livrables</h2>
            <p>
              Niveau général attendu : {formatSkillLevel(mission.requiredLevel)}
            </p>
            <ul className="mission-skills mission-skills-detail">
              {mission.skills.map((skill) => (
                <li key={skill.id}>
                  {skill.name} · {formatSkillLevel(skill.requiredLevel)}
                </li>
              ))}
            </ul>
            <h3>Livrables attendus</h3>
            <ul className="mission-deliverables">
              {mission.deliverables.map((deliverable) => (
                <li key={deliverable}>{deliverable}</li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2>Organisation</h2>
            <ul className="mission-facts mission-facts-detail">
              <li>
                <MapPin aria-hidden="true" size={18} />{' '}
                {getMissionLocation(mission)}
              </li>
              {mission.workMode === 'hybrid' && mission.presenceDetails ? (
                <li>
                  <Info aria-hidden="true" size={18} />{' '}
                  {mission.presenceDetails}
                </li>
              ) : null}
              <li>
                <CalendarDays aria-hidden="true" size={18} /> Candidatures
                jusqu’au {formatMissionDate(mission.applicationDeadline)}
              </li>
              <li>
                <CalendarDays aria-hidden="true" size={18} /> Du{' '}
                {formatMissionDate(mission.startsOn)} au{' '}
                {formatMissionDate(mission.endsOn)}
                {mission.flexibleSchedule ? ' · dates flexibles' : ''}
              </li>
              <li>
                <Info aria-hidden="true" size={18} />{' '}
                {formatMissionBudget(mission)}
              </li>
            </ul>
          </Card>

          <aside className="mission-non-payment-note">
            <strong>Budget de mise en relation uniquement</strong>
            <p>
              SkillMatch facilite la mise en relation et ne traite aucun
              paiement. Les modalités de rémunération sont gérées directement
              entre les participants.
            </p>
          </aside>
        </div>

        <aside className="mission-owner-panel">
          <Card>
            <p className="eyebrow">Profil public du client</p>
            <div className="mission-owner-public">
              <Avatar
                name={mission.owner.displayName}
                size="lg"
                {...(avatarUrl ? { src: avatarUrl } : {})}
              />
              <div>
                <h2>{mission.owner.displayName}</h2>
                <p>@{mission.owner.username}</p>
              </div>
            </div>
            {mission.owner.headline ? <p>{mission.owner.headline}</p> : null}
            {mission.owner.emailVerified ? (
              <Badge aria-label="E-mail confirmé par Supabase" tone="success">
                <ShieldCheck aria-hidden="true" size={14} /> E-mail vérifié
              </Badge>
            ) : null}
            <p className="privacy-note">
              Les coordonnées exactes et les informations privées du client ne
              sont pas affichées.
            </p>
            {!isOwner ? (
              <div className="profile-safety-actions">
                <ReportDialog
                  label="Signaler le profil"
                  targetId={mission.owner.id}
                  targetLabel="ce profil"
                  targetType="profile"
                />
                <ConfirmDialog
                  confirmLabel="Bloquer le profil"
                  description="Ses missions seront retirées de votre découverte. Toute nouvelle candidature, création de match ou écriture sera refusée par la base. L’historique déjà partagé reste lisible."
                  onConfirm={() => blockMutation.mutateAsync()}
                  title={`Bloquer ${mission.owner.displayName} ?`}
                  trigger={
                    <Button variant="quiet">
                      <Ban aria-hidden="true" size={17} /> Bloquer
                    </Button>
                  }
                  variant="danger"
                />
              </div>
            ) : null}
          </Card>
          {isOwner && mission.applicationCount !== null ? (
            <Card className="application-count-card">
              <strong>{mission.applicationCount}</strong>
              <span>
                {mission.applicationCount > 1
                  ? 'candidatures reçues'
                  : 'candidature reçue'}
              </span>
              <small>
                Comptage réel, visible uniquement par le propriétaire.
              </small>
            </Card>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
