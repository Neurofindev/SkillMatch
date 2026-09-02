import { describe, expect, it } from 'vitest';

import { reviewFormSchema } from '@/features/reviews/reviewSchemas';

const validReview = {
  comment: 'Collaboration claire.',
  communication: 4,
  quality: 5,
  rating: 4,
  reliability: 4,
};

describe('reviewFormSchema', () => {
  it('accepte uniquement des notes entières entre 1 et 5', () => {
    expect(reviewFormSchema.safeParse(validReview).success).toBe(true);
    expect(
      reviewFormSchema.safeParse({ ...validReview, rating: 0 }).success,
    ).toBe(false);
    expect(
      reviewFormSchema.safeParse({ ...validReview, quality: 4.5 }).success,
    ).toBe(false);
  });

  it('accepte un commentaire vide mais refuse un commentaire trop court', () => {
    expect(
      reviewFormSchema.safeParse({ ...validReview, comment: '' }).success,
    ).toBe(true);
    expect(
      reviewFormSchema.safeParse({ ...validReview, comment: 'ok' }).success,
    ).toBe(false);
  });
});
