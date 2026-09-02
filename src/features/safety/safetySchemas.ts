import { z } from 'zod';

export const reportReasonSchema = z.enum([
  'harassment',
  'spam',
  'illegal_activity',
  'dangerous_activity',
  'sensitive_data',
  'impersonation',
  'fraud',
  'discrimination',
  'abuse',
  'other',
]);

export const reportFormSchema = z.object({
  confirmed: z.boolean().refine((value) => value, {
    message: 'Confirmez que les informations sont factuelles avant l’envoi.',
  }),
  description: z
    .string()
    .trim()
    .min(20, 'Décrivez la situation en au moins 20 caractères.')
    .max(1500, 'La description ne peut pas dépasser 1 500 caractères.'),
  reason: reportReasonSchema,
});

export type ReportFormValues = z.infer<typeof reportFormSchema>;

export const moderationActionSchema = z.object({
  action: z.enum([
    'triage',
    'dismiss',
    'resolve',
    'hide_mission',
    'suspend_profile',
  ]),
  reason: z
    .string()
    .trim()
    .min(10, 'Indiquez un motif d’au moins 10 caractères.')
    .max(1000, 'Le motif ne peut pas dépasser 1 000 caractères.'),
});

export type ModerationActionValues = z.infer<typeof moderationActionSchema>;

export const deletionRequestSchema = z.object({
  confirmation: z
    .string()
    .refine((value): boolean => value === 'SUPPRIMER MON COMPTE', {
      message: 'Recopiez exactement « SUPPRIMER MON COMPTE ».',
    }),
  reason: z
    .string()
    .trim()
    .max(1000, 'Le motif ne peut pas dépasser 1 000 caractères.')
    .refine((value) => value.length === 0 || value.length >= 10, {
      message: 'Le motif facultatif doit contenir au moins 10 caractères.',
    }),
});

export type DeletionRequestValues = z.infer<typeof deletionRequestSchema>;
