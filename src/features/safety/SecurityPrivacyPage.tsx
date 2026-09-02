import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Download,
  FileLock2,
  ShieldCheck,
  Trash2,
  UserRoundCog,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/ui';
import { getAvatarPublicUrl } from '@/features/profiles/avatar';
import {
  getAccountExport,
  getFrenchSafetyError,
  getModerationAccess,
  listBlockedProfiles,
  requestAccountDeletion,
  setProfileBlock,
} from '@/features/safety/safetyApi';
import {
  deletionRequestSchema,
  type DeletionRequestValues,
} from '@/features/safety/safetySchemas';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getSupabaseClient } from '@/lib/supabase/client';

const safetyQueryKeys = {
  all: ['safety'] as const,
  blocks: ['safety', 'blocks'] as const,
  moderationAccess: ['safety', 'moderation-access'] as const,
};

function downloadJson(data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `skillmatch-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function SecurityPrivacyPage() {
  useDocumentTitle('Sécurité et confidentialité');
  const client = getSupabaseClient();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [requestStatus, setRequestStatus] = useState('');
  const blocksQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => listBlockedProfiles(client!),
    queryKey: safetyQueryKeys.blocks,
  });
  const moderationAccessQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => getModerationAccess(client!),
    queryKey: safetyQueryKeys.moderationAccess,
  });
  const exportMutation = useMutation({
    mutationFn: () => {
      if (!client) throw new Error('SUPABASE_UNAVAILABLE');
      return getAccountExport(client);
    },
    onError: (error) =>
      notify({
        description: getFrenchSafetyError(error),
        title: 'Export impossible',
        tone: 'danger',
      }),
    onSuccess: (data) => {
      downloadJson(data);
      notify({
        description:
          'Le fichier contient uniquement les données autorisées de votre compte.',
        title: 'Export téléchargé',
        tone: 'success',
      });
    },
  });
  const unblockMutation = useMutation({
    mutationFn: (profileId: string) => {
      if (!client) throw new Error('SUPABASE_UNAVAILABLE');
      return setProfileBlock(client, profileId, false);
    },
    onError: (error) =>
      notify({
        description: getFrenchSafetyError(error),
        title: 'Déblocage impossible',
        tone: 'danger',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: safetyQueryKeys.blocks });
      notify({
        description:
          'Les nouvelles interactions redeviennent possibles si l’autre personne ne vous bloque pas.',
        title: 'Profil débloqué',
        tone: 'success',
      });
    },
  });
  const deletionForm = useForm<DeletionRequestValues>({
    defaultValues: { confirmation: '', reason: '' },
    resolver: zodResolver(deletionRequestSchema),
  });
  const deletionMutation = useMutation({
    mutationFn: (values: DeletionRequestValues) => {
      if (!client) throw new Error('SUPABASE_UNAVAILABLE');
      return requestAccountDeletion(client, values.confirmation, values.reason);
    },
    onError: (error) => setRequestStatus(getFrenchSafetyError(error)),
    onSuccess: (result) => {
      setRequestStatus(
        `Demande enregistrée le ${new Intl.DateTimeFormat('fr-FR', {
          dateStyle: 'long',
          timeStyle: 'short',
        }).format(
          new Date(result.requestedAt),
        )}. Elle reste en attente de traitement serveur.`,
      );
      deletionForm.reset();
    },
  });

  return (
    <section className="security-page">
      <header className="page-heading-row">
        <div>
          <p className="eyebrow">Contrôle du compte</p>
          <h1>Sécurité et confidentialité</h1>
          <p>
            Gérez vos blocages et obtenez une copie limitée de vos données sans
            exposer celles des autres participants.
          </p>
        </div>
        {moderationAccessQuery.data ? (
          <Link className="button button-secondary" to="/espace/moderation">
            <UserRoundCog aria-hidden="true" size={18} /> Espace modération
          </Link>
        ) : null}
      </header>

      <div className="security-grid">
        <Card>
          <ShieldCheck aria-hidden="true" className="section-icon" />
          <h2>Ce qui est public</h2>
          <p>
            Votre nom affiché, username, bio, headline, compétences,
            disponibilité choisie et zone approximative peuvent être montrés
            selon vos réglages.
          </p>
          <p>
            Votre e-mail, vos données d’authentification, vos coordonnées
            exactes, conversations et pièces jointes privées ne font pas partie
            du profil public.
          </p>
          <Link to="/espace/profil">Vérifier mes réglages de profil</Link>
        </Card>

        <Card>
          <FileLock2 aria-hidden="true" className="section-icon" />
          <h2>Exporter mes données</h2>
          <p>
            L’export JSON est généré depuis vos données réellement stockées. Il
            exclut les secrets Auth, les coordonnées exactes et les profils
            privés d’autres personnes.
          </p>
          <Button
            isLoading={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
            variant="secondary"
          >
            <Download aria-hidden="true" size={18} /> Télécharger mon export
          </Button>
        </Card>
      </div>

      <Card className="blocked-profiles-card">
        <div className="section-title-row">
          <div>
            <h2>Profils bloqués</h2>
            <p>
              Le blocage empêche les nouvelles candidatures, les nouveaux matchs
              et les nouveaux messages. L’historique déjà partagé reste lisible.
            </p>
          </div>
          <Ban aria-hidden="true" size={24} />
        </div>
        {blocksQuery.isPending ? (
          <Skeleton label="Chargement des blocages" lines={3} />
        ) : null}
        {blocksQuery.isError ? (
          <ErrorState
            action={{
              label: 'Réessayer',
              onClick: () => void blocksQuery.refetch(),
            }}
            description={getFrenchSafetyError(blocksQuery.error)}
            title="Blocages indisponibles"
          />
        ) : null}
        {blocksQuery.data?.length === 0 ? (
          <EmptyState
            description="Aucun profil n’est bloqué depuis ce compte."
            title="Aucun blocage"
          />
        ) : null}
        {blocksQuery.data?.length ? (
          <ul className="blocked-profile-list">
            {blocksQuery.data.map((profile) => {
              const avatarUrl = client
                ? getAvatarPublicUrl(client, profile.avatarPath)
                : undefined;
              return (
                <li key={profile.id}>
                  <Avatar
                    name={profile.displayName}
                    {...(avatarUrl ? { src: avatarUrl } : {})}
                  />
                  <div>
                    <strong>{profile.displayName}</strong>
                    <span>@{profile.username}</span>
                  </div>
                  <Button
                    isLoading={
                      unblockMutation.isPending &&
                      unblockMutation.variables === profile.id
                    }
                    onClick={() => unblockMutation.mutate(profile.id)}
                    variant="secondary"
                  >
                    Débloquer
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>

      <Card className="account-deletion-card">
        <Trash2 aria-hidden="true" className="section-icon danger-icon" />
        <h2>Demander la suppression du compte</h2>
        <p>
          Cette action crée une demande persistante. Elle ne supprime pas
          immédiatement votre compte : une intervention serveur reste nécessaire
          pour vérifier les obligations de conservation, anonymiser les
          relations historiques et supprimer les fichiers applicables.
        </p>
        <form
          className="deletion-request-form"
          noValidate
          onSubmit={(event) =>
            void deletionForm.handleSubmit((values) =>
              deletionMutation.mutate(values),
            )(event)
          }
        >
          <FormField
            error={deletionForm.formState.errors.reason?.message}
            id="deletion-reason"
            label="Motif facultatif"
          >
            {(props) => (
              <Textarea
                {...props}
                maxLength={1000}
                {...deletionForm.register('reason')}
              />
            )}
          </FormField>
          <FormField
            description="Recopiez exactement : SUPPRIMER MON COMPTE"
            error={deletionForm.formState.errors.confirmation?.message}
            id="deletion-confirmation"
            label="Confirmation"
            required
          >
            {(props) => (
              <Input {...props} {...deletionForm.register('confirmation')} />
            )}
          </FormField>
          <Button
            isLoading={deletionMutation.isPending}
            type="submit"
            variant="danger"
          >
            Enregistrer ma demande
          </Button>
          {requestStatus ? (
            <p className="status-banner status-banner-warning" role="status">
              {requestStatus}
            </p>
          ) : null}
        </form>
      </Card>
    </section>
  );
}
