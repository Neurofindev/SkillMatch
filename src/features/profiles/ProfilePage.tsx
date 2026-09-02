import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LockKeyhole, MailCheck, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/ui';
import { getAvatarPublicUrl } from '@/features/profiles/avatar';
import {
  getReputationSummary,
  reviewQueryKeys,
} from '@/features/reviews/reviewApi';
import {
  AvatarUploader,
  SkillsEditor,
} from '@/features/profiles/ProfileFields';
import {
  getDefaultProfileValues,
  profileFormSchema,
  type ProfileFormValues,
} from '@/features/profiles/profileSchemas';
import {
  detailsToFormValues,
  getFrenchProfileError,
  getOwnProfileDetails,
  isUsernameAvailable,
  listSkills,
  saveProfile,
} from '@/features/profiles/profileApi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getSupabaseClient } from '@/lib/supabase/client';

const capabilityLabels = {
  both: 'Trouver et publier',
  find: 'Trouver des missions',
  publish: 'Publier des missions',
} as const;

const workLabels = {
  both: 'Local et à distance',
  local: 'Local uniquement',
  remote: 'À distance uniquement',
} as const;

export function ProfilePage() {
  useDocumentTitle('Mon profil');
  const auth = useAuth();
  const client = getSupabaseClient();
  const userId = auth.user?.id;
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const detailsQuery = useQuery({
    enabled: Boolean(client && userId),
    queryFn: () => getOwnProfileDetails(client!, userId!),
    queryKey: ['own-profile', userId],
  });
  const skillsQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => listSkills(client!),
    queryKey: ['skills', 'active'],
    staleTime: 5 * 60_000,
  });
  const dashboardQuery = useQuery({
    enabled: Boolean(client && userId),
    queryFn: async () => {
      const { data, error } = await client!.rpc('get_dashboard_stats');
      if (error) throw error;
      return data[0] ?? null;
    },
    queryKey: ['dashboard-stats', userId],
  });
  const reputationQuery = useQuery({
    enabled: Boolean(client && userId),
    queryFn: () => getReputationSummary(client!, userId!),
    queryKey: reviewQueryKeys.reputation(userId ?? ''),
  });

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
  } = useForm<ProfileFormValues>({
    defaultValues: getDefaultProfileValues(),
    resolver: zodResolver(profileFormSchema),
    shouldFocusError: true,
  });

  useEffect(() => {
    if (detailsQuery.data) reset(detailsToFormValues(detailsQuery.data));
  }, [detailsQuery.data, reset]);

  const values = useWatch({ control }) as ProfileFormValues;
  const submit = async (submitted: ProfileFormValues) => {
    if (!client || !userId) return;
    setSubmitError(null);
    try {
      if (!(await isUsernameAvailable(client, submitted.username))) {
        setError('username', {
          message: 'Ce username est déjà utilisé.',
          type: 'validate',
        });
        return;
      }
      await saveProfile(client, userId, submitted, false, true);
      auth.refreshProfile();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['own-profile', userId] }),
        queryClient.invalidateQueries({
          queryKey: ['dashboard-stats', userId],
        }),
        queryClient.invalidateQueries({ queryKey: ['reputation', userId] }),
      ]);
      notify({
        description:
          'Les informations publiques et préférences ont été enregistrées.',
        title: 'Profil mis à jour',
        tone: 'success',
      });
    } catch (error) {
      setSubmitError(getFrenchProfileError(error));
    }
  };

  if (detailsQuery.isLoading) {
    return <Skeleton label="Chargement du profil" lines={8} />;
  }
  if (detailsQuery.isError || !detailsQuery.data || !client || !userId) {
    return (
      <ErrorState
        action={{
          label: 'Réessayer',
          onClick: () => void detailsQuery.refetch(),
        }}
        description="Le profil n’a pas pu être chargé. Vérifiez votre connexion."
        title="Profil indisponible"
      />
    );
  }

  const avatarUrl = getAvatarPublicUrl(client, values.avatarPath);
  const stats = dashboardQuery.data;
  const reputation = reputationQuery.data;

  return (
    <section className="profile-page">
      <header className="profile-heading">
        <div className="profile-identity">
          <Avatar
            name={values.displayName || 'Profil'}
            size="lg"
            {...(avatarUrl ? { src: avatarUrl } : {})}
          />
          <div>
            <p className="eyebrow">Profil public</p>
            <h1>{values.displayName || 'Mon profil'}</h1>
            <p>@{values.username}</p>
          </div>
        </div>
        {auth.user?.emailConfirmed ? (
          <Badge tone="success">
            <MailCheck aria-hidden="true" size={15} /> E-mail vérifié
          </Badge>
        ) : null}
      </header>

      <div className="profile-summary-grid">
        <Card>
          {reputation?.reviewCount ? (
            <div className="profile-metric">
              <strong>{reputation.averageRating}/5</strong>
              <span>
                {reputation.reviewCount} avis relié
                {reputation.reviewCount > 1 ? 's' : ''} à une mission clôturée
              </span>
            </div>
          ) : (
            <EmptyState
              description="Les nouveaux profils ne reçoivent aucun score par défaut. Seuls des avis liés à une mission clôturée apparaîtront ici."
              title="Aucun avis pour le moment"
            />
          )}
        </Card>
        <Card>
          {stats?.owned_missions ? (
            <div className="profile-metric">
              <strong>{stats.owned_missions}</strong>
              <span>
                mission{stats.owned_missions > 1 ? 's' : ''} publiée
                {stats.owned_missions > 1 ? 's' : ''} ou préparée
              </span>
            </div>
          ) : (
            <EmptyState
              description="Aucune mission n’est inventée pour remplir ce profil."
              title="Aucune mission publiée"
            />
          )}
        </Card>
      </div>

      <Card className="profile-form-card">
        <div className="section-heading compact">
          <p className="eyebrow">Modification</p>
          <h2>Informations et préférences</h2>
          <p>Les coordonnées exactes ne font jamais partie du profil public.</p>
        </div>
        {submitError ? (
          <div
            className="form-alert form-alert-error"
            role="alert"
            tabIndex={-1}
          >
            {submitError}
          </div>
        ) : null}
        <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
          <div className="form-grid-two">
            <FormField
              error={errors.displayName?.message}
              id="profile-display-name"
              label="Nom affiché"
              required
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('displayName')}
                  autoComplete="name"
                />
              )}
            </FormField>
            <FormField
              error={errors.username?.message}
              id="profile-username"
              label="Username"
              required
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('username')}
                  autoCapitalize="none"
                  autoComplete="username"
                />
              )}
            </FormField>
          </div>
          <FormField
            error={errors.headline?.message}
            id="profile-headline"
            label="Accroche"
          >
            {(field) => <Input {...field} {...register('headline')} />}
          </FormField>
          <FormField
            error={errors.bio?.message}
            id="profile-bio"
            label="Bio"
            required
          >
            {(field) => <Textarea {...field} {...register('bio')} rows={7} />}
          </FormField>

          <fieldset className="choice-fieldset">
            <legend>Capacités du compte *</legend>
            {Object.entries(capabilityLabels).map(([value, label]) => (
              <label key={value}>
                <input type="radio" value={value} {...register('capability')} />
                <span>{label}</span>
              </label>
            ))}
            {errors.capability ? (
              <p className="field-error" role="alert">
                {errors.capability.message}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="choice-fieldset">
            <legend>Modes de travail *</legend>
            {Object.entries(workLabels).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  value={value}
                  {...register('workPreference')}
                />
                <span>{label}</span>
              </label>
            ))}
            {errors.workPreference ? (
              <p className="field-error" role="alert">
                {errors.workPreference.message}
              </p>
            ) : null}
          </fieldset>

          <div className="form-grid-two">
            <FormField
              error={errors.city?.message}
              id="profile-city"
              label="Ville approximative"
              required={values.workPreference !== 'remote'}
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('city')}
                  autoComplete="address-level2"
                />
              )}
            </FormField>
            <FormField
              error={errors.countryCode?.message}
              id="profile-country"
              label="Code pays"
              required={values.workPreference !== 'remote'}
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('countryCode')}
                  autoComplete="country"
                  maxLength={2}
                />
              )}
            </FormField>
          </div>
          <Checkbox
            {...register('showApproximateLocation')}
            label="Afficher ma zone approximative sur le profil public."
          />

          <SkillsEditor
            error={errors.skills?.message}
            onChange={(skills) =>
              setValue('skills', skills, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            options={skillsQuery.data ?? []}
            selected={values.skills}
          />

          <div className="form-grid-two">
            <FormField
              error={errors.availabilityStart?.message}
              id="profile-availability-start"
              label="Disponible à partir du"
              required
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('availabilityStart')}
                  type="date"
                />
              )}
            </FormField>
            <FormField
              error={errors.availabilityEnd?.message}
              id="profile-availability-end"
              label="Jusqu’au"
              required
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('availabilityEnd')}
                  type="date"
                />
              )}
            </FormField>
          </div>
          <FormField
            error={errors.availabilityVisibility?.message}
            id="profile-availability-visibility"
            label="Visibilité de la disponibilité"
            required
          >
            {(field) => (
              <Select {...field} {...register('availabilityVisibility')}>
                <option value="private">Privée</option>
                <option value="matched">Participants après un match</option>
                <option value="public">Publique</option>
              </Select>
            )}
          </FormField>

          <AvatarUploader
            client={client}
            displayName={values.displayName}
            onChange={(path) =>
              setValue('avatarPath', path, { shouldDirty: true })
            }
            path={values.avatarPath}
            userId={userId}
          />

          <div className="profile-form-actions">
            <Button isLoading={isSubmitting} type="submit">
              <Save aria-hidden="true" size={18} /> Enregistrer les
              modifications
            </Button>
            <p>
              <CheckCircle2 aria-hidden="true" size={16} /> Les compétences et
              disponibilités sont enregistrées avec le profil.
            </p>
          </div>
        </form>
      </Card>
      <Card className="profile-security-link-card">
        <LockKeyhole aria-hidden="true" size={24} />
        <div>
          <h2>Sécurité et confidentialité</h2>
          <p>
            Gérez les profils bloqués, téléchargez votre export et consultez la
            procédure honnête de suppression du compte.
          </p>
        </div>
        <Link className="button button-secondary" to="/espace/securite">
          Ouvrir les réglages de sécurité
        </Link>
      </Card>
    </section>
  );
}
