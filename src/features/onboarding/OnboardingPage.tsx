import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch, type FieldPath } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import {
  Button,
  Card,
  Checkbox,
  FormField,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import {
  AvatarUploader,
  SkillsEditor,
} from '@/features/profiles/ProfileFields';
import {
  getDefaultOnboardingValues,
  onboardingSchema,
  usernameSchema,
  type OnboardingValues,
} from '@/features/profiles/profileSchemas';
import {
  findOrCreateSkill,
  getFrenchProfileError,
  getOnboardingDraft,
  isUsernameAvailable,
  listSkills,
  saveOnboardingDraft,
  saveProfile,
} from '@/features/profiles/profileApi';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getSupabaseClient } from '@/lib/supabase/client';

const steps = [
  'Identité publique',
  'Capacités',
  'Modes de travail',
  'Zone approximative',
  'Compétences',
  'Présentation',
  'Disponibilité',
  'Avatar',
  'Confirmation',
] as const;

const stepFields: Record<number, FieldPath<OnboardingValues>[]> = {
  1: ['displayName', 'username'],
  2: ['capability'],
  3: ['workPreference'],
  4: ['city', 'countryCode', 'showApproximateLocation'],
  5: ['skills'],
  6: ['bio'],
  7: ['availabilityStart', 'availabilityEnd', 'availabilityVisibility'],
  8: ['avatarPath'],
  9: ['adultConfirmed'],
};

const capabilityLabels = {
  both: 'Trouver et publier des missions',
  find: 'Trouver des missions',
  publish: 'Publier des missions',
} as const;

const workLabels = {
  both: 'Local et à distance',
  local: 'Local uniquement',
  remote: 'À distance uniquement',
} as const;

function radioError(message: string | undefined, id: string) {
  return message ? (
    <p className="field-error" id={id} role="alert">
      {message}
    </p>
  ) : null;
}

export function OnboardingPage() {
  useDocumentTitle('Onboarding');
  const auth = useAuth();
  const client = getSupabaseClient();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hydratedUserId = useRef<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialValues = useMemo(() => {
    const defaults = getDefaultOnboardingValues();
    const initialCapability =
      auth.session?.user.user_metadata.initial_capability;
    if (['find', 'publish', 'both'].includes(String(initialCapability))) {
      defaults.capability = initialCapability as OnboardingValues['capability'];
    }
    return defaults;
  }, [auth.session?.user.user_metadata.initial_capability]);

  const {
    control,
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    trigger,
  } = useForm<OnboardingValues>({
    defaultValues: initialValues,
    resolver: zodResolver(onboardingSchema),
    shouldFocusError: true,
  });

  const userId = auth.user?.id;
  const skillsQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => listSkills(client!),
    queryKey: ['skills', 'active'],
    staleTime: 5 * 60_000,
  });
  const draftQuery = useQuery({
    enabled: Boolean(client && userId),
    queryFn: () => getOnboardingDraft(client!, userId!),
    queryKey: ['onboarding-draft', userId],
    retry: 1,
  });

  useEffect(() => {
    if (!userId || !draftQuery.isFetched || hydratedUserId.current === userId) {
      return;
    }
    hydratedUserId.current = userId;
    if (draftQuery.data) {
      const parsed = onboardingSchema.safeParse(draftQuery.data.payload);
      if (parsed.success) {
        const savedStep = draftQuery.data.current_step;
        queueMicrotask(() => {
          reset(parsed.data);
          setCurrentStep(savedStep);
        });
      }
    }
  }, [draftQuery.data, draftQuery.isFetched, reset, userId]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [currentStep]);

  const values = useWatch({ control }) as OnboardingValues;

  const persist = async (step: number) => {
    if (!client || !userId) return false;
    setSaveState('saving');
    setSubmitError(null);
    try {
      await saveOnboardingDraft(client, userId, step, getValues());
      setSaveState('saved');
      return true;
    } catch (error) {
      setSaveState('idle');
      setSubmitError(getFrenchProfileError(error));
      return false;
    }
  };

  const next = async () => {
    const fields = stepFields[currentStep] ?? [];
    const valid = await trigger(fields);
    if (!valid) return;

    if (currentStep === 1 && client) {
      const parsed = usernameSchema.safeParse(getValues('username'));
      if (!parsed.success) return;
      try {
        if (!(await isUsernameAvailable(client, parsed.data))) {
          setError('username', {
            message: 'Ce username est déjà utilisé.',
            type: 'validate',
          });
          return;
        }
      } catch (error) {
        setSubmitError(getFrenchProfileError(error));
        return;
      }
    }

    const nextStep = Math.min(9, currentStep + 1);
    if (await persist(nextStep)) setCurrentStep(nextStep);
  };

  const previous = async () => {
    const previousStep = Math.max(1, currentStep - 1);
    await persist(previousStep);
    setCurrentStep(previousStep);
  };

  const complete = async (submitted: OnboardingValues) => {
    if (!client || !userId) return;
    setSubmitError(null);
    try {
      if (!(await isUsernameAvailable(client, submitted.username))) {
        setCurrentStep(1);
        setError('username', {
          message: 'Ce username est déjà utilisé.',
          type: 'validate',
        });
        return;
      }
      await saveProfile(
        client,
        userId,
        submitted,
        true,
        submitted.adultConfirmed,
      );
      auth.refreshProfile();
      navigate('/espace', { replace: true });
    } catch (error) {
      setSubmitError(getFrenchProfileError(error));
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="form-section">
            <FormField
              error={errors.displayName?.message}
              id="onboarding-display-name"
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
              description="Visible publiquement. Lettres, chiffres, tirets et underscores."
              error={errors.username?.message}
              id="onboarding-username"
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
        );
      case 2:
        return (
          <fieldset className="choice-fieldset">
            <legend>Que voulez-vous faire ? *</legend>
            {Object.entries(capabilityLabels).map(([value, label]) => (
              <label key={value}>
                <input type="radio" value={value} {...register('capability')} />
                <span>{label}</span>
              </label>
            ))}
            {radioError(errors.capability?.message, 'capability-error')}
          </fieldset>
        );
      case 3:
        return (
          <fieldset className="choice-fieldset">
            <legend>Où souhaitez-vous travailler ? *</legend>
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
            <p className="field-description">
              Les missions entièrement à distance ne sont jamais pénalisées par
              la distance.
            </p>
            {radioError(errors.workPreference?.message, 'work-error')}
          </fieldset>
        );
      case 4:
        return (
          <div className="form-section">
            <p className="privacy-note">
              Indiquez uniquement une zone approximative. Aucune adresse exacte
              n’est demandée.
            </p>
            <FormField
              error={errors.city?.message}
              id="onboarding-city"
              label={
                values.workPreference === 'remote'
                  ? 'Ville approximative (facultatif)'
                  : 'Ville approximative'
              }
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
              id="onboarding-country"
              label={
                values.workPreference === 'remote'
                  ? 'Code pays (facultatif)'
                  : 'Code pays'
              }
              required={values.workPreference !== 'remote'}
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('countryCode')}
                  autoComplete="country"
                  maxLength={2}
                  placeholder="FR"
                />
              )}
            </FormField>
            <Checkbox
              {...register('showApproximateLocation')}
              label="Afficher cette zone approximative sur mon profil public."
            />
          </div>
        );
      case 5:
        return (
          <SkillsEditor
            error={errors.skills?.message}
            onCreate={(name) => findOrCreateSkill(client!, name)}
            onChange={(skills) =>
              setValue('skills', skills, { shouldValidate: true })
            }
            options={skillsQuery.data ?? []}
            selected={values.skills}
          />
        );
      case 6:
        return (
          <FormField
            description="20 à 2 000 caractères. N’ajoutez aucune coordonnée privée."
            error={errors.bio?.message}
            id="onboarding-bio"
            label="Bio courte"
            required
          >
            {(field) => <Textarea {...field} {...register('bio')} rows={7} />}
          </FormField>
        );
      case 7:
        return (
          <div className="form-section form-grid-two">
            <FormField
              error={errors.availabilityStart?.message}
              id="availability-start"
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
              id="availability-end"
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
            <FormField
              description="Privé : vous seulement. Participants : après un match. Public : visible sur le profil."
              error={errors.availabilityVisibility?.message}
              id="availability-visibility"
              label="Visibilité"
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
          </div>
        );
      case 8:
        return client && userId ? (
          <AvatarUploader
            client={client}
            displayName={values.displayName}
            onChange={(path) =>
              setValue('avatarPath', path, { shouldDirty: true })
            }
            path={values.avatarPath}
            userId={userId}
          />
        ) : null;
      case 9:
        return (
          <div className="onboarding-review">
            <dl>
              <div>
                <dt>Identité</dt>
                <dd>
                  {values.displayName} · @{values.username}
                </dd>
              </div>
              <div>
                <dt>Capacités</dt>
                <dd>{capabilityLabels[values.capability]}</dd>
              </div>
              <div>
                <dt>Modes</dt>
                <dd>{workLabels[values.workPreference]}</dd>
              </div>
              <div>
                <dt>Zone publique</dt>
                <dd>
                  {values.showApproximateLocation && values.city
                    ? `${values.city}${values.countryCode ? `, ${values.countryCode}` : ''}`
                    : 'Masquée'}
                </dd>
              </div>
              <div>
                <dt>Compétences</dt>
                <dd>
                  {values.skills.length} sélectionnée
                  {values.skills.length > 1 ? 's' : ''}
                </dd>
              </div>
              <div>
                <dt>Disponibilité</dt>
                <dd>
                  Du {values.availabilityStart} au {values.availabilityEnd}
                </dd>
              </div>
            </dl>
            <Checkbox
              {...register('adultConfirmed')}
              aria-describedby={
                errors.adultConfirmed ? 'onboarding-adult-error' : undefined
              }
              aria-invalid={Boolean(errors.adultConfirmed)}
              label="Je confirme déclarer avoir au moins 18 ans."
            />
            {errors.adultConfirmed ? (
              <p
                className="field-error"
                id="onboarding-adult-error"
                role="alert"
              >
                {errors.adultConfirmed.message}
              </p>
            ) : null}
            {!auth.user?.emailConfirmed ? (
              <p className="form-alert form-alert-error" role="alert">
                Confirmez votre adresse e-mail avant de terminer l’onboarding.
              </p>
            ) : null}
          </div>
        );
      default:
        return null;
    }
  };

  if (draftQuery.isLoading) {
    return (
      <main className="onboarding-page" id="contenu">
        <p role="status">Reprise de votre onboarding…</p>
      </main>
    );
  }

  return (
    <main className="onboarding-page" id="contenu">
      <header className="onboarding-header">
        <p className="eyebrow">Création du profil</p>
        <h1 ref={headingRef} tabIndex={-1}>
          {steps[currentStep - 1]}
        </h1>
        <p>
          Étape {currentStep} sur {steps.length}
        </p>
        <progress
          aria-label={`Progression : étape ${currentStep} sur ${steps.length}`}
          max={steps.length}
          value={currentStep}
        />
      </header>
      <Card className="onboarding-card">
        {draftQuery.isError ? (
          <p className="form-alert form-alert-error" role="alert">
            La reprise enregistrée n’a pas pu être chargée. Vous pouvez
            continuer puis réessayer.
          </p>
        ) : null}
        {skillsQuery.isError ? (
          <p className="form-alert form-alert-error" role="alert">
            La liste des compétences est indisponible. Vérifiez votre connexion.
          </p>
        ) : null}
        {submitError ? (
          <p className="form-alert form-alert-error" role="alert" tabIndex={-1}>
            {submitError}
          </p>
        ) : null}
        <form
          onSubmit={(event) => void handleSubmit(complete)(event)}
          noValidate
        >
          {renderStep()}
          <div className="onboarding-actions">
            <Button
              disabled={
                currentStep === 1 || isSubmitting || saveState === 'saving'
              }
              onClick={() => void previous()}
              variant="secondary"
            >
              <ArrowLeft aria-hidden="true" size={18} /> Précédent
            </Button>
            <span className="save-status" role="status">
              {saveState === 'saving' ? (
                <>
                  <Save aria-hidden="true" size={16} /> Enregistrement…
                </>
              ) : saveState === 'saved' ? (
                <>
                  <CheckCircle2 aria-hidden="true" size={16} /> Étape
                  enregistrée
                </>
              ) : null}
            </span>
            {currentStep < 9 ? (
              <Button
                disabled={saveState === 'saving'}
                onClick={() => void next()}
              >
                Continuer <ArrowRight aria-hidden="true" size={18} />
              </Button>
            ) : (
              <Button
                disabled={!auth.user?.emailConfirmed}
                isLoading={isSubmitting}
                type="submit"
              >
                Terminer mon profil{' '}
                <CheckCircle2 aria-hidden="true" size={18} />
              </Button>
            )}
          </div>
        </form>
      </Card>
    </main>
  );
}
