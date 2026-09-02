import { describe, expect, it } from 'vitest';

import {
  getMessageAttachmentPath,
  getSafeAttachmentName,
  validateMessageAttachment,
} from '@/features/conversations/attachments';

describe('message attachments', () => {
  it('accepte uniquement les types autorisés sous 10 Mio', () => {
    expect(() =>
      validateMessageAttachment(
        new File(['contenu'], 'note.txt', { type: 'text/plain' }),
      ),
    ).not.toThrow();
    expect(() =>
      validateMessageAttachment(
        new File(['script'], 'script.html', { type: 'text/html' }),
      ),
    ).toThrow('MESSAGE_ATTACHMENT_TYPE');
  });

  it('construit un chemin propriétaire et nettoie le nom visible', () => {
    expect(getSafeAttachmentName('../preuve\\finale.txt')).toBe(
      '..-preuve-finale.txt',
    );
    expect(
      getMessageAttachmentPath(
        'conversation-id',
        'user-id',
        'client-id',
        'application/pdf',
      ),
    ).toBe('conversation-id/user-id/client-id.pdf');
  });
});
