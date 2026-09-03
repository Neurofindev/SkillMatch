import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, FilePenLine, Plus, Send, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/FeedbackStates';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import {
  archiveMission,
  deleteMissionWizardDraft,
  getFrenchMissionError,
  listMissionWizardDrafts,
  listOwnMissions,
  missionQueryKeys,
  transitionMission,
  type MissionWizardDraft,
  type OwnMissionListItem,
} from '@/features/missions/missionApi';
import { formatMissionStatus } from '@/features/missions/missionView';
import { formatWorkMode } from '@/lib/format';
import { getSupabaseClient } from '@/lib/supabase/client';

function getDraftTitle(draft: MissionWizardDraft): string {
  const payload = draft.payload;
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return 'Brouillon sans titre';
  }
  const title = (payload as { title?: unknown }).title;
  return typeof title === 'string' && title.trim()
    ? title
    : 'Brouillon sans titre';
}

export function MyMissionsPage() {
  const auth = useAuth();
  const client = getSupabaseClient();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const userId = auth.user?.id ?? '';
  const canHire = Boolean(auth.profile?.canHire);
  const missionsQuery = useQuery({
    enabled: Boolean(client && userId),
    queryFn: () => listOwnMissions(client!, userId),
    queryKey: missionQueryKeys.mine,
  });
  const draftsQuery = useQuery({
    enabled: Boolean(client && userId),
    queryFn: () => listMissionWizardDrafts(client!, userId),
    queryKey: missionQueryKeys.drafts,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: missionQueryKeys.mine }),
      queryClient.invalidateQueries({ queryKey: missionQueryKeys.drafts }),
      queryClient.invalidateQueries({ queryKey: missionQueryKeys.all }),
    ]);
  };

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      mission,
    }: {
      action: 'archive' | 'cancel' | 'publish';
      mission: OwnMissionListItem;
    }) => {
      if (!client) throw new Error('SUPABASE_REQUIRED');
      if (action === 'archive') {
        await archiveMission(client, mission.id, mission.lockVersion);
      } else {
        await transitionMission(
          client,
          mission.id,
          mission.lockVersion,
          action === 'publish' ? 'published' : 'cancelled',
        );
      }
    },
    onError: (error) => {
      notify({
        description: getFrenchMissionError(error),
        title: 'Action impossible',
        tone: 'danger',
      });
    },
    onSuccess: async (_data, variables) => {
      const labels = {
        archive: 'Mission archivée',
        cancel: 'Mission annulée',
        publish: 'Mission publiée',
      };
      notify({ title: labels[variables.action], tone: 'success' });
      await refresh();
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      if (!client || !userId) throw new Error('AUTH_REQUIRED');
      await deleteMissionWizardDraft(client, userId, draftId);
    },
    onError: (error) =>
      notify({
        description: getFrenchMissionError(error),
        title: 'Brouillon non supprimé',
        tone: 'danger',
      }),
    onSuccess: async () => {
      notify({ title: 'Brouillon supprimé', tone: 'success' });
      await refresh();
    },
  });

  const isLoading = missionsQuery.isLoading || draftsQuery.isLoading;
  const queryError = missionsQuery.error ?? draftsQuery.error;
  const drafts = draftsQuery.data ?? [];
  const missions = missionsQuery.data ?? [];

  return (
    <section className="missions-page my-missions-page">
      <header className="missions-page-heading">
        <div>
          <p className="eyebrow">Espace client</p>
          <h1>Mes missions</h1>
          <p>
            Reprenez un brouillon, publiez un besoin complet et suivez ses
            statuts réels.
          </p>
        </div>
        <Link
          className="button button-primary"
          to={
            canHire ? '/espace/missions/nouvelle' : '/espace/profil#capacites'
          }
        >
          <Plus aria-hidden="true" size={18} />{' '}
          {canHire ? 'Créer une mission' : 'Activer la publication'}
        </Link>
      </header>

      {!canHire ? (
        <Card className="form-alert">
          <h2>Activez la capacité « publier une mission »</h2>
          <p>
            Votre compte peut conserver ses activités actuelles et ajouter la
            publication de missions depuis le profil, sans créer un second
            compte.
          </p>
          <Link
            className="button button-secondary"
            to="/espace/profil#capacites"
          >
            Modifier les capacités du compte
          </Link>
        </Card>
      ) : null}

      <aside className="mission-non-payment-note">
        <strong>Le budget reste informatif.</strong>
        <p>
          SkillMatch ne reçoit, ne conserve et ne transfère jamais d’argent.
        </p>
      </aside>

      {isLoading ? (
        <Skeleton label="Chargement de vos missions" lines={8} />
      ) : null}
      {queryError ? (
        <ErrorState
          action={{
            label: 'Réessayer',
            onClick: () => {
              void missionsQuery.refetch();
              void draftsQuery.refetch();
            },
          }}
          description={getFrenchMissionError(queryError)}
          title="Vos missions ne peuvent pas être chargées"
        />
      ) : null}

      {!isLoading && !queryError ? (
        <div className="owner-missions-sections">
          <section aria-labelledby="wizard-drafts-title">
            <div className="section-title-row">
              <div>
                <h2 id="wizard-drafts-title">Brouillons du formulaire</h2>
                <p>
                  Ces sauvegardes privées permettent de reprendre une création
                  interrompue.
                </p>
              </div>
              <Badge>{drafts.length}</Badge>
            </div>
            {drafts.length ? (
              <div className="owner-mission-grid">
                {drafts.map((draft) => (
                  <Card key={draft.id}>
                    <Badge tone="warning">
                      Étape {draft.current_step} sur 9
                    </Badge>
                    <h3>{getDraftTitle(draft)}</h3>
                    <p>
                      Dernière sauvegarde :{' '}
                      {new Date(draft.updated_at).toLocaleString('fr-FR')}
                    </p>
                    <div className="owner-mission-actions">
                      <Link
                        className="button button-primary"
                        to={`/espace/missions/brouillons/${draft.id}`}
                      >
                        <FilePenLine aria-hidden="true" size={18} /> Reprendre
                      </Link>
                      <ConfirmDialog
                        confirmLabel="Supprimer"
                        description="Le brouillon et ses pièces jointes privées seront supprimés."
                        onConfirm={() =>
                          deleteDraftMutation.mutateAsync(draft.id)
                        }
                        title="Supprimer ce brouillon ?"
                        trigger={<Button variant="danger">Supprimer</Button>}
                        variant="danger"
                      />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="inline-empty">Aucun formulaire interrompu.</p>
            )}
          </section>

          <section aria-labelledby="saved-missions-title">
            <div className="section-title-row">
              <div>
                <h2 id="saved-missions-title">Missions enregistrées</h2>
                <p>
                  Le nombre de candidatures provient de la base et reste réservé
                  au propriétaire.
                </p>
              </div>
              <Badge>{missions.length}</Badge>
            </div>
            {missions.length ? (
              <div className="owner-mission-grid">
                {missions.map((mission) => (
                  <Card
                    className={mission.archivedAt ? 'is-archived' : undefined}
                    key={mission.id}
                  >
                    <div className="mission-badges">
                      <Badge
                        tone={
                          mission.status === 'published' ? 'success' : 'neutral'
                        }
                      >
                        {formatMissionStatus(mission.status)}
                      </Badge>
                      {mission.archivedAt ? <Badge>Archivée</Badge> : null}
                    </div>
                    <h3>
                      <Link to={`/espace/missions/${mission.id}`}>
                        {mission.title}
                      </Link>
                    </h3>
                    <p>
                      {formatWorkMode(mission.workMode)} · {mission.category}
                    </p>
                    <p className="real-count">
                      <strong>{mission.applicationCount}</strong>{' '}
                      {mission.applicationCount > 1
                        ? 'candidatures'
                        : 'candidature'}
                    </p>
                    {!mission.archivedAt ? (
                      <div className="owner-mission-actions">
                        {['draft', 'published', 'selecting'].includes(
                          mission.status,
                        ) ? (
                          <Link
                            className="button button-secondary"
                            to={`/espace/missions/${mission.id}/modifier`}
                          >
                            <FilePenLine aria-hidden="true" size={18} />{' '}
                            Modifier
                          </Link>
                        ) : null}
                        {mission.status === 'draft' ? (
                          <ConfirmDialog
                            confirmLabel="Publier"
                            description="La mission deviendra visible aux talents si toutes les règles serveur sont respectées."
                            onConfirm={() =>
                              actionMutation.mutateAsync({
                                action: 'publish',
                                mission,
                              })
                            }
                            title="Publier cette mission ?"
                            trigger={
                              <Button>
                                <Send aria-hidden="true" size={18} /> Publier
                              </Button>
                            }
                          />
                        ) : null}
                        {['published', 'selecting'].includes(mission.status) ? (
                          <ConfirmDialog
                            confirmLabel="Annuler la mission"
                            description="La mission ne sera plus visible dans la découverte. Cette transition est enregistrée."
                            onConfirm={() =>
                              actionMutation.mutateAsync({
                                action: 'cancel',
                                mission,
                              })
                            }
                            title="Annuler cette mission ?"
                            trigger={
                              <Button variant="danger">
                                <XCircle aria-hidden="true" size={18} /> Annuler
                              </Button>
                            }
                            variant="danger"
                          />
                        ) : null}
                        {['draft', 'cancelled', 'completed'].includes(
                          mission.status,
                        ) ? (
                          <ConfirmDialog
                            confirmLabel="Archiver"
                            description="La mission restera dans votre historique mais ne sera plus active."
                            onConfirm={() =>
                              actionMutation.mutateAsync({
                                action: 'archive',
                                mission,
                              })
                            }
                            title="Archiver cette mission ?"
                            trigger={
                              <Button variant="secondary">
                                <Archive aria-hidden="true" size={18} />{' '}
                                Archiver
                              </Button>
                            }
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                action={{
                  label: canHire
                    ? 'Créer ma première mission'
                    : 'Activer la publication',
                  onClick: () =>
                    window.location.assign(
                      canHire
                        ? '/espace/missions/nouvelle'
                        : '/espace/profil#capacites',
                    ),
                }}
                description="Les nouveaux comptes ne sont pas pénalisés : commencez par un brouillon sauvegardable."
                title="Aucune mission enregistrée"
              />
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
