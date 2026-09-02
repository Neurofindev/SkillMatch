import { describe, expect, it } from 'vitest';

import {
  messageComposerSchema,
  reportSchema,
} from '@/features/conversations/conversationSchemas';

describe('messageComposerSchema', () => {
  it('refuse un message vide et limite le corps à 5 000 caractères', () => {
    expect(messageComposerSchema.safeParse({ body: '   ' }).success).toBe(
      false,
    );
    expect(
      messageComposerSchema.safeParse({ body: 'a'.repeat(5001) }).success,
    ).toBe(false);
    expect(messageComposerSchema.parse({ body: '  Bonjour  ' }).body).toBe(
      'Bonjour',
    );
  });
});

describe('reportSchema', () => {
  it('exige un motif fermé et une description factuelle', () => {
    expect(
      reportSchema.safeParse({ description: 'Court', reason: 'spam' }).success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({
        description: 'Description suffisamment détaillée.',
        reason: 'payment',
      }).success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({
        description: 'Description suffisamment détaillée.',
        reason: 'harassment',
      }).success,
    ).toBe(true);
  });
});
