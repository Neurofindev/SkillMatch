import { describe, expect, it } from 'vitest';

import {
  conversationWorkspaceSchema,
  messageComposerSchema,
  reportSchema,
} from '@/features/conversations/conversationSchemas';

const workspace = {
  agreement: null,
  application: {
    id: '10000000-0000-4000-8000-000000000001',
    status: 'submitted',
  },
  conversation: {
    archivedAt: null,
    blockedByMe: false,
    canSend: true,
    id: '20000000-0000-4000-8000-000000000001',
    isBlocked: false,
    joinedAt: '2026-09-03T12:00:00.000Z',
    lastReadAt: null,
  },
  counterpart: {
    avatarPath: null,
    bio: null,
    city: null,
    countryCode: null,
    displayName: 'Compte test',
    headline: null,
    id: '30000000-0000-4000-8000-000000000001',
    remoteAvailable: true,
    username: 'compte-test',
  },
  match: null,
  mission: {
    id: '40000000-0000-4000-8000-000000000001',
    status: 'published',
    title: 'Mission de test',
    workMode: 'remote',
  },
};

describe('conversationWorkspaceSchema', () => {
  it('accepte une conversation de candidature avant la création du match', () => {
    expect(conversationWorkspaceSchema.parse(workspace).match).toBeNull();
  });

  it('accepte ensuite le même espace avec son match réel', () => {
    expect(
      conversationWorkspaceSchema.parse({
        ...workspace,
        application: { ...workspace.application, status: 'accepted' },
        match: {
          id: '50000000-0000-4000-8000-000000000001',
          role: 'talent',
          status: 'active',
        },
      }).match,
    ).not.toBeNull();
  });
});

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
