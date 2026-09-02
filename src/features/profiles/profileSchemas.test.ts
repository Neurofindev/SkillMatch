import { describe, expect, it } from 'vitest';

import {
  getDefaultOnboardingValues,
  onboardingSchema,
} from '@/features/profiles/profileSchemas';

function validOnboarding() {
  return {
    ...getDefaultOnboardingValues(),
    bio: 'Je présente clairement mes compétences pour de futures missions.',
    city: 'Lyon',
    countryCode: 'FR',
    displayName: 'Camille Test',
    skills: [{ level: 'advanced' as const, skillId: 1 }],
    username: 'camille-test',
  };
}

describe('validation du profil et de l’onboarding', () => {
  it('accepte un compte avec les deux capacités et les deux modes', () => {
    const result = onboardingSchema.safeParse({
      ...validOnboarding(),
      capability: 'both',
      workPreference: 'both',
    });
    expect(result.success).toBe(true);
  });

  it('refuse un onboarding incomplet', () => {
    const result = onboardingSchema.safeParse({
      ...validOnboarding(),
      bio: 'Trop court',
      skills: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.bio).toBeDefined();
      expect(result.error.flatten().fieldErrors.skills).toBeDefined();
    }
  });

  it('exige une zone approximative pour le mode local', () => {
    const result = onboardingSchema.safeParse({
      ...validOnboarding(),
      city: '',
      countryCode: '',
      workPreference: 'local',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.city).toContain(
        'Indiquez une ville ou zone approximative.',
      );
    }
  });

  it('autorise le mode remote sans localisation', () => {
    const result = onboardingSchema.safeParse({
      ...validOnboarding(),
      city: '',
      countryCode: '',
      workPreference: 'remote',
    });
    expect(result.success).toBe(true);
  });

  it('refuse une fin de disponibilité antérieure au début', () => {
    const result = onboardingSchema.safeParse({
      ...validOnboarding(),
      availabilityEnd: '2026-08-20',
      availabilityStart: '2026-08-21',
    });
    expect(result.success).toBe(false);
  });
});
