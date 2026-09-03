import { z } from 'zod';

export const MESSAGE_MAX_LENGTH = 5000;

export const messageComposerSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Écrivez un message avant de l’envoyer.')
    .max(
      MESSAGE_MAX_LENGTH,
      `Le message ne peut pas dépasser ${MESSAGE_MAX_LENGTH.toLocaleString('fr-FR')} caractères.`,
    ),
});

export type MessageComposerValues = z.infer<typeof messageComposerSchema>;

export const reportSchema = z.object({
  description: z
    .string()
    .trim()
    .min(10, 'Décrivez la situation en au moins 10 caractères.')
    .max(3000, 'La description ne peut pas dépasser 3 000 caractères.'),
  reason: z.enum(
    [
      'harassment',
      'spam',
      'illegal_activity',
      'dangerous_activity',
      'sensitive_data',
      'impersonation',
      'other',
    ],
    { message: 'Choisissez un motif.' },
  ),
});

export type ReportValues = z.infer<typeof reportSchema>;

const participantSchema = z.object({
  avatarPath: z.string().nullable(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  displayName: z.string(),
  headline: z.string().nullable(),
  id: z.string().uuid(),
  remoteAvailable: z.boolean(),
  username: z.string(),
});

export const conversationWorkspaceSchema = z.object({
  agreement: z
    .object({
      id: z.string().uuid(),
      status: z.string(),
      version: z.number().int().positive(),
    })
    .nullable(),
  conversation: z.object({
    archivedAt: z.string().nullable(),
    blockedByMe: z.boolean(),
    canSend: z.boolean(),
    id: z.string().uuid(),
    isBlocked: z.boolean(),
    joinedAt: z.string(),
    lastReadAt: z.string().nullable(),
  }),
  counterpart: participantSchema,
  application: z.object({
    id: z.string().uuid(),
    status: z.enum([
      'submitted',
      'viewed',
      'shortlisted',
      'accepted',
      'rejected',
      'withdrawn',
    ]),
  }),
  match: z
    .object({
      id: z.string().uuid(),
      role: z.enum(['client', 'talent']),
      status: z.enum(['active', 'cancelled', 'completed']),
    })
    .nullable(),
  mission: z.object({
    id: z.string().uuid(),
    status: z.string(),
    title: z.string(),
    workMode: z.enum(['local', 'remote', 'hybrid']),
  }),
});

export type ConversationWorkspace = z.infer<typeof conversationWorkspaceSchema>;
