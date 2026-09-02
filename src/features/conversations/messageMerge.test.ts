import { describe, expect, it } from 'vitest';

import type { ConversationMessage } from '@/features/conversations/conversationApi';
import {
  mergeMessages,
  type PendingMessage,
} from '@/features/conversations/messageMerge';

const persisted: ConversationMessage = {
  attachment: null,
  authorDisplayName: 'Alex',
  authorId: 'user-1',
  body: 'Persisté',
  clientMessageId: 'client-1',
  createdAt: '2026-08-31T10:00:00.000Z',
  deletedAt: null,
  editedAt: null,
  id: 'message-1',
};

const pending: PendingMessage = {
  attachment: null,
  body: 'Optimiste',
  clientMessageId: 'client-1',
  createdAt: '2026-08-31T10:00:00.000Z',
  error: null,
  file: null,
  status: 'sending',
};

describe('mergeMessages', () => {
  it('déduplique le message optimiste quand la base ou Realtime le retourne', () => {
    const result = mergeMessages([persisted, persisted], [pending]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'message-1', pending: false });
  });

  it('conserve un envoi échoué tant qu’il n’est pas persisté', () => {
    const result = mergeMessages([], [{ ...pending, status: 'failed' }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ pending: true, status: 'failed' });
  });
});
