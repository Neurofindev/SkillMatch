import { z } from 'zod';

const ratingSchema = z.coerce
  .number({
    invalid_type_error: 'Choisissez une note entière.',
  })
  .int('Choisissez une note entière.')
  .min(1, 'La note minimale est 1.')
  .max(5, 'La note maximale est 5.');

export const reviewFormSchema = z.object({
  comment: z
    .string()
    .trim()
    .max(2000, 'Le commentaire ne peut pas dépasser 2 000 caractères.')
    .refine(
      (value) => value.length === 0 || value.length >= 3,
      'Le commentaire doit contenir au moins 3 caractères.',
    ),
  communication: ratingSchema,
  quality: ratingSchema,
  rating: ratingSchema,
  reliability: ratingSchema,
});

export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

export const defaultReviewValues: ReviewFormValues = {
  comment: '',
  communication: 3,
  quality: 3,
  rating: 3,
  reliability: 3,
};
