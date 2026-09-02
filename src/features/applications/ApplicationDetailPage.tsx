import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  BriefcaseBusiness,
  GitCompareArrows,
  MapPin,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui';
import {
  applicationQueryKeys,
  getApplication,
  getFrenchApplicationError,
  recordApplicationSwipe,
  transitionApplication,
} from '@/features/applications/applicationApi';
import { RelevanceScore } from '@/features/applications/RelevanceScore';
import {
  canReview,
  canWithdraw,
  formatApplicationDate,
  formatApplicationStatus,
  formatProposal,
} from '@/features/applications/applicationView';
import { formatSkillLevel } from '@/features/missions/missionView';
import { getAvatarPublicUrl } from '@/features/profiles/avatar';
import { ReportDialog } from '@/features/safety/ReportDialog';
import {
  getFrenchSafetyError,
  setProfileBlock,
} from '@/features/safety/safetyApi';
import {
  acceptApplication,
  getFrenchMatchError,
  matchQueryKeys,
} from '@/features/matches/matchApi';
import { getSupabaseClient } from '@/lib/supabase/client';

export function ApplicationDetailPage() {
  const { applicationId = '' } = useParams();
  const client = getSupabaseClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const markedViewed = useRef(false);
  const [actionError, setActionError] = useState('');
  const detailQuery = useQuery({
    enabled: Boolean(client && applicationId),
    queryFn: () => getApplication(client!, applicationId),
    queryKey: applicationQueryKeys.detail(applicationId),
  });
  const result = detailQuery.data;
  const actionMutation = useMutation({
    mutationFn: async (
      action: 'accept' | 'compare' | 'reject' | 'shortlist' | 'withdraw',
    ) => {
      if (!client || !result) throw new Error('APPLICATION_NOT_FOUND');
      if (action === 'accept') {
        return acceptApplication(client, result.item);
      }
      if (action === 'compare' || action === 'shortlist') {
        await recordApplicationSwipe(client, result.item, action);
      } else {
        await transitionApplication(
          client,
          result.item,
          action === 'reject' ? 'rejected' : 'withdrawn',
        );
      }
    },
    onError: (error, action) =>
      setActionError(
        action === 'accept'
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
  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!client || !result) throw new Error('APPLICATION_NOT_FOUND');
      await setProfileBlock(client, result.item.applicant.id, true);
    },
    onError: (error) => setActionError(getFrenchSafetyError(error)),
    onMutate: () => setActionError(''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.all,
      });
      navigate('/espace/candidatures?vue=recues');
    },
  });

  useEffect(() => {
    if (
      !client ||
      !result ||
      result.scope !== 'received' ||
      result.item.status !== 'submitted' ||
      markedViewed.current
    ) {
      return;
    }
    markedViewed.current = true;
    void transitionApplication(client, result.item, 'viewed')
      .then(() =>
        queryClient.invalidateQueries({ queryKey: applicationQueryKeys.all }),
      )
      .catch((error: unknown) => {
        setActionError(getFrenchApplicationError(error));
      });
  }, [client, queryClient, result]);

  if (detailQuery.isLoading) {
    return <Skeleton label="Chargement de la candidature" lines={10} />;
  }
  if (detailQuery.isError) {
    return (
      <ErrorState
        action={{
          label: 'Réessayer',
          onClick: () => void detailQuery.refetch(),
        }}
        description={getFrenchApplicationError(detailQuery.error)}
        title="La candidature ne peut pas être chargée"
      />
    );
  }
  if (!result) {
    return (
      <EmptyState
        description="Cette candidature n’existe pas ou n’est pas accessible à votre compte."
        title="Candidature introuvable"
      />
    );
  }

  const { item, scope } = result;
  const avatarUrl = client
    ? getAvatarPublicUrl(client, item.applicant.avatarPath)
    : undefined;

  return (
    <section className="application-detail-page">
      <Link
        className="back-link"
        to={`/espace/candidatures${scope === 'received' ? '?vue=recues' : ''}`}
      >
        <ArrowLeft aria-hidden="true" size={18} /> Retour aux candidatures
      </Link>
      <header className="application-detail-heading">
        <div>
          <Badge>{formatApplicationStatus(item.status)}</Badge>
          <h1>
            {scope === 'received'
              ? item.applicant.displayName
              : item.mission.title}
          </h1>
          <p>Envoyée le {formatApplicationDate(item.createdAt)}</p>
        </div>
        <div className="application-detail-actions">
          {scope === 'received' && canReview(item.status) ? (
            <>
              <Button
                onClick={() => actionMutation.mutate('compare')}
                variant="secondary"
              >
                <GitCompareArrows aria-hidden="true" size={18} /> Comparer
              </Button>
              <Button onClick={() => actionMutation.mutate('shortlist')}>
                <Star aria-hidden="true" size={18} /> Présélectionner
              </Button>
              <ConfirmDialog
                confirmLabel="Refuser la candidature"
                description="Le refus est final et ne peut jamais être déclenché par un swipe."
                onConfirm={() => actionMutation.mutateAsync('reject')}
                title="Confirmer le refus"
                trigger={<Button variant="danger">Refuser</Button>}
                variant="danger"
              />
              {item.status === 'shortlisted' ? (
                <ConfirmDialog
                  confirmLabel="Accepter cette candidature"
                  description="Une seule candidature sera acceptée. Les autres candidatures ouvertes seront refusées et un espace de collaboration unique sera créé."
                  onConfirm={() => actionMutation.mutateAsync('accept')}
                  title="Retenir ce talent ?"
                  trigger={
                    <Button disabled={actionMutation.isPending}>
                      Accepter
                    </Button>
                  }
                />
              ) : null}
            </>
          ) : null}
          {scope === 'talent' && canWithdraw(item.status) ? (
            <ConfirmDialog
              confirmLabel="Retirer ma candidature"
              description="Le retrait est final tant que la candidature n’est pas acceptée."
              onConfirm={() => actionMutation.mutateAsync('withdraw')}
              title="Retirer la candidature ?"
              trigger={<Button variant="danger">Retirer</Button>}
              variant="danger"
            />
          ) : null}
        </div>
      </header>
      {actionError ? (
        <p className="field-error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="application-detail-layout">
        <div className="application-detail-main">
          <Card>
            <p className="eyebrow">Mission</p>
            <h2>{item.mission.title}</h2>
            <Link to={`/espace/missions/${item.mission.id}`}>
              Voir la mission
            </Link>
          </Card>
          <Card>
            <h2>Message</h2>
            <p className="preserve-lines">{item.message}</p>
            <h3>Disponibilité annoncée</h3>
            <p className="preserve-lines">{item.availabilityNote}</p>
            <h3>Proposition</h3>
            <p>{formatProposal(item)}</p>
            <small>
              La proposition reste une information de mise en relation et ne
              déclenche aucun flux financier.
            </small>
            {scope === 'received' ? (
              <div className="profile-safety-actions">
                <ReportDialog
                  label="Signaler le profil"
                  targetId={item.applicant.id}
                  targetLabel="ce profil"
                  targetType="profile"
                />
                <ConfirmDialog
                  confirmLabel="Bloquer le talent"
                  description="Toute nouvelle candidature, création de match ou écriture entre vos comptes sera refusée par la base. L’historique déjà partagé reste lisible."
                  onConfirm={() => blockMutation.mutateAsync()}
                  title={`Bloquer ${item.applicant.displayName} ?`}
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
          <Card>
            <RelevanceScore details={item.relevance} />
          </Card>
        </div>

        <aside className="application-profile-panel">
          <Card>
            <p className="eyebrow">Profil public autorisé</p>
            <div className="application-profile-heading">
              <Avatar
                name={item.applicant.displayName}
                size="lg"
                {...(avatarUrl ? { src: avatarUrl } : {})}
              />
              <div>
                <h2>{item.applicant.displayName}</h2>
                <p>@{item.applicant.username}</p>
              </div>
            </div>
            {item.applicant.emailVerified ? (
              <Badge aria-label="E-mail confirmé par Supabase" tone="success">
                <ShieldCheck aria-hidden="true" size={14} /> E-mail vérifié
              </Badge>
            ) : null}
            {item.applicant.headline ? <p>{item.applicant.headline}</p> : null}
            {item.applicant.bio ? <p>{item.applicant.bio}</p> : null}
            <ul className="application-profile-facts">
              <li>
                <MapPin aria-hidden="true" size={17} />
                {item.applicant.city
                  ? `${item.applicant.city}${item.applicant.countryCode ? ` · ${item.applicant.countryCode}` : ''}`
                  : 'Zone approximative masquée'}
              </li>
              <li>
                <BriefcaseBusiness aria-hidden="true" size={17} />
                {item.applicant.completedCount} mission(s) terminée(s)
              </li>
            </ul>
            <h3>Compétences déclarées</h3>
            {item.applicant.skills.length ? (
              <ul className="mission-skills">
                {item.applicant.skills.map((skill) => (
                  <li key={skill.id}>
                    {skill.name} · {formatSkillLevel(skill.level)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Aucune compétence publique renseignée.</p>
            )}
            <p className="neutral-reputation">
              {item.applicant.reviewCount
                ? `${item.applicant.reputation?.toFixed(1)}/5 · ${item.applicant.reviewCount} avis lié(s) à des missions terminées`
                : 'Nouveau profil : aucun avis, sans pénalité automatique.'}
            </p>
            <small>
              Aucune coordonnée exacte ni donnée sensible n’est affichée ou
              utilisée dans le score.
            </small>
          </Card>
          {item.conversationId ? (
            <Link
              className="button button-primary"
              to={`/espace/messages?conversation=${item.conversationId}`}
            >
              Ouvrir la conversation
            </Link>
          ) : (
            <p className="inline-empty">
              La conversation sera accessible uniquement si une future
              acceptation crée un match réel.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
