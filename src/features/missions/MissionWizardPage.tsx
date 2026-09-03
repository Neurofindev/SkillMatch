import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  Checkbox,
  FormField,
  Input,
  Select,
  Textarea,
} from '@/components/ui/FormControls';
import { ErrorState } from '@/components/ui/FeedbackStates';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { SkillsEditor } from '@/features/profiles/ProfileFields';
import { findOrCreateSkill } from '@/features/profiles/profileApi';
import {
  draftPayloadToValues,
  getFrenchMissionError,
  getMissionWizardDraft,
  getOwnMissionDetails,
  listMissionSkillOptions,
  missionQueryKeys,
  ownMissionToValues,
  removeMissionAttachment,
  saveMission,
  saveMissionWizardDraft,
  uploadMissionAttachment,
  type MissionAttachment,
} from '@/features/missions/missionApi';
import {
  BUDGET_MODELS,
  defaultMissionValues,
  MISSION_CATEGORIES,
  missionFormSchema,
  missionStepFields,
  SKILL_LEVELS,
  WORK_MODES,
  type MissionFormValues,
} from '@/features/missions/missionSchemas';
import {
  formatMissionDate,
  formatSkillLevel,
} from '@/features/missions/missionView';
import { getSupabaseClient } from '@/lib/supabase/client';

const stepTitles = [
  'Besoin et catégorie',
  'Compétences requises',
  'Mode de mission',
  'Zone approximative',
  'Budget informatif',
  'Dates et flexibilité',
  'Livrables et pièces jointes',
  'Prévisualisation',
  'Confirmation',
] as const;

const modeLabels = {
  hybrid: 'Hybride',
  local: 'Sur place',
  remote: 'À distance',
} as const;

function attachmentError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'ATTACHMENT_TYPE') {
    return 'Choisissez une image JPEG, PNG ou WebP, un PDF ou un fichier texte.';
  }
  if (code === 'ATTACHMENT_SIZE') {
    return 'Chaque pièce jointe doit peser entre 1 octet et 5 Mio.';
  }
  return 'La pièce jointe n’a pas pu être envoyée. Les fichiers déjà enregistrés sont conservés.';
}

export function MissionWizardPage() {
  const { draftId: routeDraftId, missionId } = useParams();
  const isEditing = Boolean(missionId);
  const auth = useAuth();
  const client = getSupabaseClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [draftId, setDraftId] = useState(routeDraftId);
  const [attachments, setAttachments] = useState<MissionAttachment[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [saveState, setSaveState] = useState('');
  const [formError, setFormError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedKey = useRef<string | undefined>(undefined);
  const form = useForm<MissionFormValues>({
    defaultValues: defaultMissionValues,
    mode: 'onBlur',
    resolver: zodResolver(missionFormSchema),
    shouldFocusError: true,
  });
  const values = useWatch({ control: form.control }) as MissionFormValues;

  const catalogQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => listMissionSkillOptions(client!),
    queryKey: missionQueryKeys.catalog,
    staleTime: 10 * 60 * 1000,
  });
  const draftQuery = useQuery({
    enabled: Boolean(client && auth.user && routeDraftId && !missionId),
    queryFn: () => getMissionWizardDraft(client!, auth.user!.id, routeDraftId),
    queryKey: [...missionQueryKeys.drafts, routeDraftId],
  });
  const editQuery = useQuery({
    enabled: Boolean(client && auth.user && missionId),
    queryFn: () => getOwnMissionDetails(client!, missionId!, auth.user!.id),
    queryKey: missionQueryKeys.detail(`edit-${missionId ?? ''}`),
  });

  useEffect(() => {
    const key = missionId
      ? `mission:${missionId}`
      : routeDraftId
        ? `draft:${routeDraftId}`
        : 'new';
    if (initializedKey.current === key) return;
    if (missionId && !editQuery.data) return;
    if (routeDraftId && !missionId && !draftQuery.data) return;
    if (key === 'new' && initializedKey.current === undefined) {
      initializedKey.current = key;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      if (missionId) {
        form.reset(ownMissionToValues(editQuery.data!));
        setAttachments(editQuery.data!.attachments);
        setCurrentStep(1);
      } else if (routeDraftId) {
        form.reset(draftPayloadToValues(draftQuery.data!.draft.payload));
        setAttachments(draftQuery.data!.attachments);
        setDraftId(draftQuery.data!.draft.id);
        setCurrentStep(draftQuery.data!.draft.current_step);
      } else {
        form.reset(defaultMissionValues);
        setCurrentStep(1);
      }
      initializedKey.current = key;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [draftQuery.data, editQuery.data, form, missionId, routeDraftId]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [currentStep]);

  const persistWizardDraft = async (
    nextStep = currentStep,
  ): Promise<string | undefined> => {
    if (!client || !auth.user || isEditing) return undefined;
    setSaveState('Sauvegarde en cours…');
    try {
      const saved = await saveMissionWizardDraft(
        client,
        auth.user.id,
        nextStep,
        form.getValues(),
        draftId,
      );
      setDraftId(saved.id);
      setSaveState('Brouillon sauvegardé');
      if (!routeDraftId) {
        navigate(`/espace/missions/brouillons/${saved.id}`, { replace: true });
      }
      return saved.id;
    } catch (error) {
      const message = getFrenchMissionError(error);
      setSaveState('Sauvegarde interrompue');
      setFormError(message);
      throw error;
    }
  };

  const goNext = async () => {
    setFormError('');
    const valid = await form.trigger(missionStepFields[currentStep], {
      shouldFocus: true,
    });
    if (!valid) return;
    const nextStep = Math.min(9, currentStep + 1);
    try {
      await persistWizardDraft(nextStep);
      setCurrentStep(nextStep);
    } catch {
      // The visible error preserves the current form and lets the user retry.
    }
  };

  const saveAndExit = async () => {
    if (isEditing) {
      navigate('/espace/missions');
      return;
    }
    try {
      await persistWizardDraft(currentStep);
      notify({ title: 'Brouillon sauvegardé', tone: 'success' });
      navigate('/espace/missions');
    } catch {
      // Error already exposed next to the form.
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!client || !auth.user) throw new Error('AUTH_REQUIRED');
      let targetDraftId = draftId;
      if (!isEditing && !targetDraftId) {
        targetDraftId = await persistWizardDraft(currentStep);
      }
      if (!isEditing && !targetDraftId) throw new Error('ATTACHMENT_TARGET');
      return uploadMissionAttachment(client, file, auth.user.id, {
        ...(isEditing && missionId
          ? { missionId }
          : { draftId: targetDraftId! }),
      });
    },
    onError: (error) => {
      setFormError(attachmentError(error));
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onSuccess: (attachment) => {
      setAttachments((current) => [...current, attachment]);
      setFormError('');
      notify({ title: 'Pièce jointe enregistrée', tone: 'success' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (attachment: MissionAttachment) => {
      if (!client) throw new Error('SUPABASE_REQUIRED');
      await removeMissionAttachment(client, attachment);
      return attachment;
    },
    onError: (error) => setFormError(getFrenchMissionError(error)),
    onSuccess: (attachment) => {
      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id),
      );
      notify({ title: 'Pièce jointe supprimée', tone: 'success' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      publish,
      submitted,
    }: {
      publish: boolean;
      submitted: MissionFormValues;
    }) => {
      if (!client) throw new Error('SUPABASE_REQUIRED');
      return saveMission(client, submitted, {
        ...(draftId ? { draftId } : {}),
        ...(missionId ? { missionId } : {}),
        ...(editQuery.data
          ? { expectedVersion: editQuery.data.mission.lock_version }
          : {}),
        publish,
      });
    },
    onError: (error) => setFormError(getFrenchMissionError(error)),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: missionQueryKeys.all });
      notify({
        title:
          result.status === 'draft'
            ? 'Mission enregistrée en brouillon'
            : 'Mission enregistrée et publiée',
        tone: 'success',
      });
      navigate(
        result.status === 'draft'
          ? '/espace/missions'
          : `/espace/missions/${result.missionId}`,
        {
          replace: true,
        },
      );
    },
  });

  const finalize = (publish: boolean) => {
    setFormError('');
    if (!confirmed) {
      setFormError('Confirmez l’exactitude du besoin avant de continuer.');
      return;
    }
    void form.handleSubmit(
      (submitted) => saveMutation.mutate({ publish, submitted }),
      () => {
        setFormError(
          'Certains champs sont incomplets. Revenez à la première étape signalée.',
        );
        const firstErrorStep = Object.keys(form.formState.errors)
          .map(
            (field) =>
              Object.entries(missionStepFields).find(([, fields]) =>
                fields.includes(field as keyof MissionFormValues),
              )?.[0],
          )
          .filter(Boolean)
          .map(Number)
          .sort((a, b) => a - b)[0];
        if (firstErrorStep) setCurrentStep(firstErrorStep);
      },
    )();
  };

  const loadingExisting =
    (Boolean(routeDraftId) && draftQuery.isLoading) ||
    (Boolean(missionId) && editQuery.isLoading);
  const existingError = draftQuery.error ?? editQuery.error;
  if (loadingExisting)
    return <Skeleton label="Chargement du brouillon" lines={8} />;
  if (existingError || (routeDraftId && draftQuery.data === null)) {
    return (
      <ErrorState
        description={
          existingError
            ? getFrenchMissionError(existingError)
            : 'Ce brouillon privé n’existe plus.'
        }
        title="Le formulaire ne peut pas être chargé"
      />
    );
  }
  if (!auth.profile?.canHire) {
    return (
      <section className="mission-wizard-page">
        <ErrorState
          action={{
            label: 'Activer la publication',
            onClick: () => navigate('/espace/profil#capacites'),
          }}
          description="Votre compte reste unique : activez « publier une mission » ou « trouver et publier » dans votre profil."
          title="La publication n’est pas encore activée"
        />
      </section>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="form-section">
            <FormField
              error={form.formState.errors.title?.message}
              id="mission-title"
              label="Titre de la mission"
              required
            >
              {(props) => (
                <Input {...props} maxLength={140} {...form.register('title')} />
              )}
            </FormField>
            <FormField
              error={form.formState.errors.category?.message}
              id="mission-category"
              label="Catégorie"
              required
            >
              {(props) => (
                <Select {...props} {...form.register('category')}>
                  {MISSION_CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField
              description="Décrivez le contexte et le résultat recherché, sans coordonnées privées ni données sensibles."
              error={form.formState.errors.description?.message}
              id="mission-description"
              label="Besoin"
              required
            >
              {(props) => (
                <Textarea
                  {...props}
                  maxLength={10_000}
                  rows={8}
                  {...form.register('description')}
                />
              )}
            </FormField>
          </div>
        );
      case 2:
        return (
          <div className="form-section">
            <FormField
              error={form.formState.errors.requiredLevel?.message}
              id="mission-level"
              label="Niveau général attendu"
              required
            >
              {(props) => (
                <Select {...props} {...form.register('requiredLevel')}>
                  {SKILL_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {formatSkillLevel(level)}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            {catalogQuery.isLoading ? (
              <Skeleton label="Chargement de vos compétences" lines={2} />
            ) : (
              <SkillsEditor
                defaultLevel={values.requiredLevel}
                error={form.formState.errors.skills?.message}
                onCreate={(name) => findOrCreateSkill(client!, name)}
                onChange={(skills) =>
                  form.setValue('skills', skills, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                options={catalogQuery.data ?? []}
                selected={values.skills}
              />
            )}
          </div>
        );
      case 3:
        return (
          <fieldset className="choice-fieldset">
            <legend>Où la mission se déroule-t-elle ?</legend>
            {WORK_MODES.map((mode) => (
              <label key={mode}>
                <input
                  type="radio"
                  value={mode}
                  {...form.register('workMode')}
                />
                <span>
                  <strong>{modeLabels[mode]}</strong>
                  <small>
                    {mode === 'remote'
                      ? 'Aucune distance ne sera calculée.'
                      : mode === 'local'
                        ? 'Seule une zone approximative sera publique.'
                        : 'Les présences nécessaires seront décrites.'}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
        );
      case 4:
        return values.workMode === 'remote' ? (
          <aside className="privacy-note">
            Cette mission est entièrement à distance. Aucune ville ni distance
            n’est demandée, affichée ou utilisée dans son classement.
          </aside>
        ) : (
          <div className="form-section">
            <div className="form-grid-two">
              <FormField
                error={form.formState.errors.publicCity?.message}
                id="mission-city"
                label="Ville approximative"
              >
                {(props) => (
                  <Input
                    {...props}
                    maxLength={100}
                    {...form.register('publicCity')}
                  />
                )}
              </FormField>
              <FormField
                error={form.formState.errors.publicRegion?.message}
                id="mission-region"
                label="Région approximative"
              >
                {(props) => (
                  <Input
                    {...props}
                    maxLength={140}
                    {...form.register('publicRegion')}
                  />
                )}
              </FormField>
            </div>
            <FormField
              description="Ex. FR, BE, CA."
              error={form.formState.errors.countryCode?.message}
              id="mission-country"
              label="Code pays"
            >
              {(props) => (
                <Input
                  {...props}
                  maxLength={2}
                  {...form.register('countryCode')}
                />
              )}
            </FormField>
            {values.workMode === 'hybrid' ? (
              <FormField
                error={form.formState.errors.presenceDetails?.message}
                id="mission-presence"
                label="Présences nécessaires"
                required
              >
                {(props) => (
                  <Textarea
                    {...props}
                    maxLength={1000}
                    {...form.register('presenceDetails')}
                  />
                )}
              </FormField>
            ) : null}
            <p className="privacy-note">
              N’indiquez aucune adresse exacte ni coordonnée privée.
            </p>
          </div>
        );
      case 5:
        return (
          <div className="form-section">
            <fieldset className="choice-fieldset">
              <legend>Type d’estimation</legend>
              {BUDGET_MODELS.map((model) => (
                <label key={model}>
                  <input
                    type="radio"
                    value={model}
                    {...form.register('budgetModel')}
                  />
                  <span>
                    {model === 'fixed' ? 'Montant fixe' : 'Taux horaire'}
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="form-grid-two">
              <FormField
                error={form.formState.errors.budgetMin?.message}
                id="mission-budget-min"
                label="Minimum indicatif"
                required
              >
                {(props) => (
                  <Input
                    {...props}
                    min="0"
                    step="1"
                    type="number"
                    {...form.register('budgetMin', { valueAsNumber: true })}
                  />
                )}
              </FormField>
              <FormField
                error={form.formState.errors.budgetMax?.message}
                id="mission-budget-max"
                label="Maximum indicatif"
                required
              >
                {(props) => (
                  <Input
                    {...props}
                    min="0"
                    step="1"
                    type="number"
                    {...form.register('budgetMax', { valueAsNumber: true })}
                  />
                )}
              </FormField>
            </div>
            <aside className="mission-non-payment-note">
              <strong>Information de mise en relation seulement.</strong>
              <p>
                SkillMatch ne traite aucun paiement et ne garantit aucune
                rémunération.
              </p>
            </aside>
          </div>
        );
      case 6:
        return (
          <div className="form-section">
            <FormField
              error={form.formState.errors.applicationDeadline?.message}
              id="mission-deadline"
              label="Échéance de candidature"
              required
            >
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  {...form.register('applicationDeadline')}
                />
              )}
            </FormField>
            <div className="form-grid-two">
              <FormField
                error={form.formState.errors.startsOn?.message}
                id="mission-start"
                label="Début"
                required
              >
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    {...form.register('startsOn')}
                  />
                )}
              </FormField>
              <FormField
                error={form.formState.errors.endsOn?.message}
                id="mission-end"
                label="Fin"
                required
              >
                {(props) => (
                  <Input {...props} type="date" {...form.register('endsOn')} />
                )}
              </FormField>
            </div>
            <Checkbox
              label="Les dates peuvent être ajustées avec le talent"
              {...form.register('flexibleSchedule')}
            />
          </div>
        );
      case 7:
        return (
          <div className="form-section">
            <FormField
              description="Un livrable par ligne, entre 1 et 10."
              error={form.formState.errors.deliverablesText?.message}
              id="mission-deliverables"
              label="Livrables attendus"
              required
            >
              {(props) => (
                <Textarea
                  {...props}
                  maxLength={3000}
                  rows={6}
                  {...form.register('deliverablesText')}
                />
              )}
            </FormField>
            <section
              className="mission-attachments"
              aria-labelledby="attachments-title"
            >
              <h3 id="attachments-title">
                Pièces jointes privées (facultatif)
              </h3>
              <p>
                Maximum 3 fichiers, 5 Mio chacun : JPEG, PNG, WebP, PDF ou
                texte. Ils restent accessibles au propriétaire uniquement.
              </p>
              <label
                className="button button-secondary"
                aria-disabled={
                  attachments.length >= 3 || uploadMutation.isPending
                }
              >
                <Upload aria-hidden="true" size={18} />
                <span>
                  {uploadMutation.isPending
                    ? 'Envoi en cours…'
                    : 'Ajouter un fichier'}
                </span>
                <input
                  accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
                  disabled={attachments.length >= 3 || uploadMutation.isPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadMutation.mutate(file);
                  }}
                  ref={fileInputRef}
                  type="file"
                />
              </label>
              <ul>
                {attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <FileText aria-hidden="true" size={18} />
                    <span>
                      {attachment.file_name} ·{' '}
                      {(attachment.size_bytes / 1024 / 1024).toFixed(2)} Mio
                    </span>
                    <Button
                      aria-label={`Supprimer ${attachment.file_name}`}
                      isLoading={
                        removeMutation.isPending &&
                        removeMutation.variables?.id === attachment.id
                      }
                      onClick={() => removeMutation.mutate(attachment)}
                      size="sm"
                      variant="quiet"
                    >
                      <Trash2 aria-hidden="true" size={18} />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        );
      case 8:
        return (
          <div className="mission-review">
            <Badge tone="primary">{values.category}</Badge>
            <h3>{values.title || 'Titre à compléter'}</h3>
            <p>{values.description || 'Besoin à compléter'}</p>
            <dl>
              <div>
                <dt>Mode</dt>
                <dd>{modeLabels[values.workMode]}</dd>
              </div>
              <div>
                <dt>Zone publique</dt>
                <dd>
                  {values.workMode === 'remote'
                    ? 'Aucune · mission à distance'
                    : [
                        values.publicCity,
                        values.publicRegion,
                        values.countryCode,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                </dd>
              </div>
              <div>
                <dt>Budget</dt>
                <dd>
                  {values.budgetMin} – {values.budgetMax} EUR · informatif
                </dd>
              </div>
              <div>
                <dt>Candidatures</dt>
                <dd>
                  Jusqu’au {formatMissionDate(values.applicationDeadline)}
                </dd>
              </div>
              <div>
                <dt>Mission</dt>
                <dd>
                  Du {formatMissionDate(values.startsOn)} au{' '}
                  {formatMissionDate(values.endsOn)}
                </dd>
              </div>
              <div>
                <dt>Compétences</dt>
                <dd>{values.skills.length} sélectionnée(s)</dd>
              </div>
              <div>
                <dt>Pièces jointes privées</dt>
                <dd>{attachments.length}</dd>
              </div>
            </dl>
          </div>
        );
      default:
        return (
          <div className="mission-confirmation">
            <Check aria-hidden="true" />
            <h3>Dernière vérification</h3>
            <p>
              La publication rendra le besoin visible à des comptes distincts.
              Une sauvegarde en brouillon restera privée.
            </p>
            <Checkbox
              checked={confirmed}
              label="Je confirme que les informations sont exactes, que la mission respecte les règles et ne contient aucune coordonnée ou donnée sensible."
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <aside className="mission-non-payment-note">
              SkillMatch facilite la mise en relation et ne traite aucun
              paiement. Les modalités de rémunération sont gérées directement
              entre les participants.
            </aside>
            <div className="finalize-actions">
              {isEditing && editQuery.data?.mission.status !== 'draft' ? (
                <Button
                  isLoading={saveMutation.isPending}
                  onClick={() => finalize(true)}
                >
                  <Save aria-hidden="true" size={18} /> Enregistrer les
                  modifications
                </Button>
              ) : (
                <>
                  <Button
                    isLoading={saveMutation.isPending}
                    onClick={() => finalize(false)}
                    variant="secondary"
                  >
                    <Save aria-hidden="true" size={18} /> Enregistrer comme
                    brouillon
                  </Button>
                  <Button
                    isLoading={saveMutation.isPending}
                    onClick={() => finalize(true)}
                  >
                    Publier la mission
                  </Button>
                </>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <section className="mission-wizard-page">
      <Link className="back-link" to="/espace/missions">
        <ArrowLeft aria-hidden="true" size={18} /> Mes missions
      </Link>
      <header className="mission-wizard-heading">
        <p className="eyebrow">
          {isEditing ? 'Modification' : 'Création progressive'}
        </p>
        <h1 ref={headingRef} tabIndex={-1}>
          {stepTitles[currentStep - 1] ?? stepTitles[0]}
        </h1>
        <p>Étape {currentStep} sur 9</p>
        <progress
          aria-label={`Progression : étape ${currentStep} sur 9`}
          max="9"
          value={currentStep}
        />
      </header>

      <Card className="mission-wizard-card">
        {formError ? (
          <div className="form-alert form-alert-error" role="alert">
            {formError}
          </div>
        ) : null}
        <form onSubmit={(event) => event.preventDefault()}>{renderStep()}</form>
        <div className="mission-wizard-actions">
          <Button
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
            variant="secondary"
          >
            <ArrowLeft aria-hidden="true" size={18} /> Précédent
          </Button>
          {!isEditing ? (
            <span className="save-status" role="status">
              {saveState}
            </span>
          ) : null}
          {currentStep < 9 ? (
            <Button onClick={() => void goNext()}>
              Suivant <ArrowRight aria-hidden="true" size={18} />
            </Button>
          ) : null}
        </div>
      </Card>

      <Button
        className="wizard-save-exit"
        onClick={() => void saveAndExit()}
        variant="quiet"
      >
        <Save aria-hidden="true" size={18} />{' '}
        {isEditing ? 'Quitter sans enregistrer' : 'Sauvegarder et quitter'}
      </Button>
    </section>
  );
}
