import { z } from 'zod';

export const applicationFormSchema = z.object({
  availabilityNote: z
    .string()
    .trim()
    .min(3, 'Précisez votre disponibilité.')
    .max(1_000, 'La disponibilité ne peut pas dépasser 1 000 caractères.'),
  message: z
    .string()
    .trim()
    .min(20, 'Votre message doit contenir au moins 20 caractères.')
    .max(3_000, 'Votre message ne peut pas dépasser 3 000 caractères.'),
  proposedAmount: z
    .number({ message: 'Indiquez un montant valide.' })
    .min(0, 'La proposition ne peut pas être négative.')
    .max(10_000_000, 'La proposition est trop élevée.')
    .optional(),
});

export const applicationConfirmationSchema = z.object({
  confirmed: z.literal(true, {
    message: 'Confirmez explicitement l’envoi de cette candidature.',
  }),
});

export type ApplicationFormValues = z.infer<typeof applicationFormSchema>;

export const APPLICATION_STATUSES = [
  'submitted',
  'viewed',
  'shortlisted',
  'accepted',
  'rejected',
  'withdrawn',
] as const;
