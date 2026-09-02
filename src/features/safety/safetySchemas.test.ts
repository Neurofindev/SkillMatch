import { describe, expect, it } from 'vitest';

import {
  deletionRequestSchema,
  moderationActionSchema,
  reportFormSchema,
} from '@/features/safety/safetySchemas';

describe('phase 10 safety validation', () => {
  it('requires an explicit factual confirmation before reporting', () => {
    expect(
      reportFormSchema.safeParse({
        confirmed: false,
        description: 'Description factuelle suffisamment longue pour examen.',
        reason: 'fraud',
      }).success,
    ).toBe(false);
  });

  it('accepts every new community-safety category', () => {
    for (const reason of ['fraud', 'discrimination', 'abuse'] as const) {
      expect(
        reportFormSchema.safeParse({
          confirmed: true,
          description: 'Description factuelle suffisamment longue pour examen.',
          reason,
        }).success,
      ).toBe(true);
    }
  });

  it('bounds report descriptions', () => {
    expect(
      reportFormSchema.safeParse({
        confirmed: true,
        description: 'Trop court.',
        reason: 'spam',
      }).success,
    ).toBe(false);
    expect(
      reportFormSchema.safeParse({
        confirmed: true,
        description: 'x'.repeat(1501),
        reason: 'spam',
      }).success,
    ).toBe(false);
  });

  it('requires a bounded audit reason for moderator actions', () => {
    expect(
      moderationActionSchema.safeParse({
        action: 'hide_mission',
        reason: 'court',
      }).success,
    ).toBe(false);
    expect(
      moderationActionSchema.safeParse({
        action: 'suspend_profile',
        reason: 'Motif documenté pour le journal de modération.',
      }).success,
    ).toBe(true);
  });

  it('does not accept an approximate account deletion confirmation', () => {
    expect(
      deletionRequestSchema.safeParse({
        confirmation: 'supprimer mon compte',
        reason: '',
      }).success,
    ).toBe(false);
    expect(
      deletionRequestSchema.safeParse({
        confirmation: 'SUPPRIMER MON COMPTE',
        reason: 'Je souhaite demander la suppression de ce compte.',
      }).success,
    ).toBe(true);
  });
});
