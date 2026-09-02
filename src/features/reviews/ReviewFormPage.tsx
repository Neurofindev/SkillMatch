import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Star } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import {
  getFrenchReviewError,
  listReviewOpportunities,
  reviewQueryKeys,
  submitReview,
} from '@/features/reviews/reviewApi';
import {
  defaultReviewValues,
  reviewFormSchema,
  type ReviewFormValues,
} from '@/features/reviews/reviewSchemas';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getSupabaseClient } from '@/lib/supabase/client';

const criterionLabels = {
  communication: 'Communication',
  quality: 'Qualité du travail ou du cadrage',
  reliability: 'Fiabilité',
} as const;

type ReviewRegister = ReturnType<typeof useForm<ReviewFormValues>>['register'];

function RatingSelect({
  error,
  id,
  label,
  name,
  register,
}: {
  error?: string | undefined;
  id: string;
  label: string;
  name: 'communication' | 'quality' | 'rating' | 'reliability';
  register: ReviewRegister;
}) {
  return (
    <FormField error={error} id={id} label={label} required>
      {(props) => (
        <Select
          {...props}
          {...register(name, {
            valueAsNumber: true,
          })}
        >
          {[1, 2, 3, 4, 5].map((rating) => (
            <option key={rating} value={rating}>
              {rating}/5
            </option>
          ))}
        </Select>
      )}
    </FormField>
  );
}

export function ReviewFormPage() {
  useDocumentTitle('Laisser un avis');
  const { matchId = '' } = useParams();
  const client = getSupabaseClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [preview, setPreview] = useState<ReviewFormValues | null>(null);
  const opportunitiesQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => listReviewOpportunities(client!),
    queryKey: reviewQueryKeys.opportunities,
  });
  const form = useForm<ReviewFormValues>({
    defaultValues: defaultReviewValues,
    resolver: zodResolver(reviewFormSchema),
    shouldFocusError: true,
  });
  const mutation = useMutation({
    mutationFn: async (values: ReviewFormValues) => {
      if (!client) throw new Error('SUPABASE_UNCONFIGURED');
      return submitReview(client, matchId, values);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['reputation'] }),
      ]);
      notify({
        description:
          'L’avis est relié à la mission terminée et visible dans la réputation.',
        title: 'Avis publié',
        tone: 'success',
      });
      navigate('/espace/avis', { replace: true });
    },
  });

  if (opportunitiesQuery.isLoading) {
    return <Skeleton label="Chargement de la mission terminée" lines={8} />;
  }
  if (opportunitiesQuery.isError) {
    return (
      <ErrorState
        action={{
          label: 'Réessayer',
          onClick: () => void opportunitiesQuery.refetch(),
        }}
        description={getFrenchReviewError(opportunitiesQuery.error)}
        title="Avis indisponible"
      />
    );
  }

  const opportunity = opportunitiesQuery.data?.find(
    ({ matchId: candidateId }) => candidateId === matchId,
  );
  if (!opportunity) {
    return (
      <EmptyState
        action={{
          label: 'Voir mes avis',
          onClick: () => navigate('/espace/avis'),
        }}
        description="Cette collaboration n’est pas terminée, n’existe plus ou ne vous appartient pas."
        title="Aucun avis disponible"
      />
    );
  }
  if (opportunity.ownReviewId) {
    return (
      <EmptyState
        action={{
          label: 'Retour aux avis',
          onClick: () => navigate('/espace/avis'),
        }}
        description={
          'Votre note de ' +
          opportunity.ownRating +
          '/5 est déjà enregistrée pour cette mission. Un seul avis est autorisé dans ce sens.'
        }
        icon={<CheckCircle2 />}
        title="Avis déjà publié"
      />
    );
  }

  return (
    <section className="review-form-page">
      <Link className="back-link" to="/espace/avis">
        <ArrowLeft aria-hidden="true" size={18} /> Retour aux avis
      </Link>
      <header className="applications-heading">
        <div>
          <Badge tone="success">Mission terminée</Badge>
          <h1>Laisser un avis à {opportunity.counterpart.displayName}</h1>
          <p>
            Mission « {opportunity.missionTitle} ». L’avis sera vérifié par ce
            lien réel, sans promettre ni certifier la qualité future.
          </p>
        </div>
      </header>

      {!preview ? (
        <Card className="review-form-card">
          <form
            noValidate
            onSubmit={(event) =>
              void form.handleSubmit((values) => setPreview(values))(event)
            }
          >
            <RatingSelect
              error={form.formState.errors.rating?.message}
              id="review-rating"
              label="Note globale"
              name="rating"
              register={form.register}
            />
            <div className="review-criteria-grid">
              {(
                Object.keys(criterionLabels) as Array<
                  keyof typeof criterionLabels
                >
              ).map((criterion) => (
                <RatingSelect
                  error={form.formState.errors[criterion]?.message}
                  id={`review-${criterion}`}
                  key={criterion}
                  label={criterionLabels[criterion]}
                  name={criterion}
                  register={form.register}
                />
              ))}
            </div>
            <FormField
              error={form.formState.errors.comment?.message}
              description="Facultatif — restez factuel et ne partagez aucune coordonnée privée."
              id="review-comment"
              label="Commentaire"
            >
              {(props) => (
                <Textarea
                  {...props}
                  {...form.register('comment')}
                  maxLength={2000}
                  rows={7}
                />
              )}
            </FormField>
            <Button type="submit">Prévisualiser l’avis</Button>
          </form>
        </Card>
      ) : (
        <Card className="review-preview-card">
          <p className="eyebrow">Prévisualisation obligatoire</p>
          <h2>
            <Star aria-hidden="true" fill="currentColor" size={20} />{' '}
            {preview.rating}/5
          </h2>
          <dl className="review-criteria-summary">
            {(
              Object.keys(criterionLabels) as Array<
                keyof typeof criterionLabels
              >
            ).map((criterion) => (
              <div key={criterion}>
                <dt>{criterionLabels[criterion]}</dt>
                <dd>{preview[criterion]}/5</dd>
              </div>
            ))}
          </dl>
          <p>{preview.comment || 'Aucun commentaire.'}</p>
          <div className="review-preview-actions">
            <Button onClick={() => setPreview(null)} variant="secondary">
              Modifier
            </Button>
            <ConfirmDialog
              confirmLabel="Publier cet avis"
              description="La publication est définitive. Un seul avis est autorisé par participant et par mission."
              onConfirm={() => mutation.mutateAsync(preview)}
              title="Confirmer la publication ?"
              trigger={
                <Button isLoading={mutation.isPending}>
                  Confirmer et publier
                </Button>
              }
            />
          </div>
          {mutation.isError ? (
            <p className="field-error" role="alert">
              {getFrenchReviewError(mutation.error)}
            </p>
          ) : null}
        </Card>
      )}
    </section>
  );
}
