import { describe, expect, it } from 'vitest';

import {
  applicationConfirmationSchema,
  applicationFormSchema,
} from '@/features/applications/applicationSchemas';

describe('applicationFormSchema', () => {
  it('valide un message, une disponibilité et une proposition facultative', () => {
    expect(
      applicationFormSchema.safeParse({
        availabilityNote: 'Disponible à partir du 15 septembre.',
        message:
          'Je peux réaliser cette mission avec une approche structurée et accessible.',
      }).success,
    ).toBe(true);
  });

  it('refuse les champs trop courts et une proposition négative', () => {
    const result = applicationFormSchema.safeParse({
      availabilityNote: 'x',
      message: 'Trop court',
      proposedAmount: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.message).toBeDefined();
      expect(result.error.flatten().fieldErrors.availabilityNote).toBeDefined();
      expect(result.error.flatten().fieldErrors.proposedAmount).toBeDefined();
    }
  });

  it('exige une confirmation littérale avant envoi', () => {
    expect(
      applicationConfirmationSchema.safeParse({ confirmed: false }).success,
    ).toBe(false);
    expect(
      applicationConfirmationSchema.safeParse({ confirmed: true }).success,
    ).toBe(true);
  });
});
