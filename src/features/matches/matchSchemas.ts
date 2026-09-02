import { z } from 'zod';

export const PLATFORM_NOTICE =
  'SkillMatch facilite la mise en relation et ne traite aucun paiement. Les modalités de rémunération sont gérées directement entre les participants.';

const participantSchema = z.object({
  avatarPath: z.string().nullable(),
  displayName: z.string(),
  emailVerified: z.boolean(),
  headline: z.string().nullable(),
  id: z.string().uuid(),
  username: z.string(),
});

const eventSchema = z.object({
  actorDisplayName: z.string().nullable(),
  actorId: z.string().uuid().nullable(),
  createdAt: z.string(),
  id: z.number(),
  metadata: z.record(z.unknown()),
  newValues: z.record(z.unknown()).nullable(),
  oldValues: z.record(z.unknown()).nullable(),
  type: z.enum([
    'mission_created',
    'mission_published',
    'selection_started',
    'talent_assigned',
    'work_started',
    'progress_updated',
    'delivery_submitted',
    'mission_completed',
    'mission_cancelled',
    'agreement_updated',
    'completion_confirmed',
    'completion_disputed',
    'moderation_updated',
  ]),
});

const deliverableSchema = z.union([
  z.string(),
  z.object({ label: z.string() }).passthrough(),
]);

export const matchWorkspaceSchema = z.object({
  agreement: z
    .object({
      budgetMax: z.number().nullable(),
      budgetMin: z.number().nullable(),
      budgetModel: z.enum(['fixed', 'hourly']),
      clientConfirmedAt: z.string().nullable(),
      createdAt: z.string(),
      currencyCode: z.string(),
      deliverables: z.array(deliverableSchema),
      endsOn: z.string().nullable(),
      id: z.string().uuid(),
      lockVersion: z.number().int().positive(),
      platformNotice: z.literal(PLATFORM_NOTICE),
      scope: z.string(),
      startsOn: z.string().nullable(),
      status: z.enum([
        'draft',
        'client_confirmed',
        'talent_confirmed',
        'confirmed',
        'active',
        'completed',
      ]),
      talentConfirmedAt: z.string().nullable(),
      updatedAt: z.string(),
      version: z.number().int().positive(),
    })
    .nullable(),
  client: participantSchema,
  completionConfirmations: z.array(
    z.object({
      createdAt: z.string(),
      decision: z.enum(['confirmed', 'disputed']),
      id: z.string().uuid(),
      note: z.string().nullable(),
      participantDisplayName: z.string(),
      participantId: z.string().uuid(),
    }),
  ),
  events: z.array(eventSchema),
  match: z.object({
    cancelledAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    conversationId: z.string().uuid().nullable(),
    id: z.string().uuid(),
    matchedAt: z.string(),
    role: z.enum(['client', 'talent']),
    status: z.enum(['active', 'completed', 'cancelled']),
  }),
  mission: z.object({
    countryCode: z.string().nullable(),
    deliverables: z.array(deliverableSchema),
    description: z.string(),
    endsOn: z.string().nullable(),
    id: z.string().uuid(),
    lockVersion: z.number().int().positive(),
    publicCity: z.string().nullable(),
    publicRegion: z.string().nullable(),
    startsOn: z.string().nullable(),
    status: z.enum([
      'draft',
      'published',
      'selecting',
      'assigned',
      'in_progress',
      'completed',
      'cancelled',
    ]),
    title: z.string(),
    workMode: z.enum(['local', 'remote', 'hybrid']),
  }),
  talent: participantSchema,
});

export type MatchWorkspace = z.infer<typeof matchWorkspaceSchema>;
export type MatchEvent = MatchWorkspace['events'][number];

export const progressSchema = z.object({
  kind: z.enum(['progress', 'delivery']),
  note: z
    .string()
    .trim()
    .min(3, 'Décrivez l’avancement en au moins 3 caractères.')
    .max(2000, 'La note ne peut pas dépasser 2 000 caractères.'),
});

export const completionSchema = z
  .object({
    decision: z.enum(['confirmed', 'disputed']),
    note: z.string().trim().max(2000, 'La note est trop longue.'),
  })
  .superRefine((values, context) => {
    if (values.decision === 'disputed' && values.note.length < 10) {
      context.addIssue({
        code: 'custom',
        message: 'Expliquez le désaccord en au moins 10 caractères.',
        path: ['note'],
      });
    }
  });

export const cancellationSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Expliquez le motif en au moins 10 caractères.')
    .max(1000, 'Le motif ne peut pas dépasser 1 000 caractères.'),
});

export type ProgressValues = z.infer<typeof progressSchema>;
export type CompletionValues = z.infer<typeof completionSchema>;
export type CancellationValues = z.infer<typeof cancellationSchema>;
