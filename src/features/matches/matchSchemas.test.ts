import { describe, expect, it } from 'vitest';

import {
  cancellationSchema,
  completionSchema,
  PLATFORM_NOTICE,
  progressSchema,
} from '@/features/matches/matchSchemas';

describe('match forms', () => {
  it('keeps the mandatory non-payment notice exact', () => {
    expect(PLATFORM_NOTICE).toBe(
      'SkillMatch facilite la mise en relation et ne traite aucun paiement. Les modalités de rémunération sont gérées directement entre les participants.',
    );
  });

  it('requires a meaningful cancellation reason', () => {
    expect(cancellationSchema.safeParse({ reason: 'court' }).success).toBe(
      false,
    );
    expect(
      cancellationSchema.safeParse({
        reason: 'Le besoin a été retiré après réévaluation.',
      }).success,
    ).toBe(true);
  });

  it('requires a reason for a disputed completion', () => {
    expect(
      completionSchema.safeParse({ decision: 'disputed', note: '' }).success,
    ).toBe(false);
    expect(
      completionSchema.safeParse({
        decision: 'disputed',
        note: 'Un livrable convenu manque encore.',
      }).success,
    ).toBe(true);
  });

  it('accepts progress and delivery notes without financial state', () => {
    expect(
      progressSchema.parse({ kind: 'delivery', note: 'Rapport final livré.' }),
    ).toEqual({ kind: 'delivery', note: 'Rapport final livré.' });
  });
});
