import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.generated';

export const MESSAGE_ATTACHMENT_BUCKET = 'message-attachments';
export const MESSAGE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const extensionsByMime = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'text/plain': 'txt',
} as const;

export type MessageAttachmentMime = keyof typeof extensionsByMime;

export interface UploadedMessageAttachment {
  mimeType: MessageAttachmentMime;
  name: string;
  path: string;
  sizeBytes: number;
}

export function validateMessageAttachment(file: File): void {
  if (!(file.type in extensionsByMime)) {
    throw new Error('MESSAGE_ATTACHMENT_TYPE');
  }
  if (file.size < 1 || file.size > MESSAGE_ATTACHMENT_MAX_BYTES) {
    throw new Error('MESSAGE_ATTACHMENT_SIZE');
  }
}

export function getSafeAttachmentName(name: string): string {
  const safe = [...name]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 ||
        code === 127 ||
        character === '/' ||
        character === '\\'
        ? '-'
        : character;
    })
    .join('')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return safe || 'piece-jointe';
}

export function getMessageAttachmentPath(
  conversationId: string,
  userId: string,
  clientMessageId: string,
  mimeType: MessageAttachmentMime,
): string {
  return `${conversationId}/${userId}/${clientMessageId}.${extensionsByMime[mimeType]}`;
}

export async function uploadMessageAttachment(
  client: SupabaseClient<Database>,
  conversationId: string,
  userId: string,
  clientMessageId: string,
  file: File,
): Promise<UploadedMessageAttachment> {
  validateMessageAttachment(file);
  const mimeType = file.type as MessageAttachmentMime;
  const path = getMessageAttachmentPath(
    conversationId,
    userId,
    clientMessageId,
    mimeType,
  );
  const { error } = await client.storage
    .from(MESSAGE_ATTACHMENT_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: mimeType,
      upsert: true,
    });
  if (error) throw new Error('MESSAGE_ATTACHMENT_UPLOAD');
  return {
    mimeType,
    name: getSafeAttachmentName(file.name),
    path,
    sizeBytes: file.size,
  };
}

export async function removeMessageAttachment(
  client: SupabaseClient<Database>,
  path: string,
): Promise<void> {
  const { error } = await client.storage
    .from(MESSAGE_ATTACHMENT_BUCKET)
    .remove([path]);
  if (error) throw new Error('MESSAGE_ATTACHMENT_REMOVE');
}

export async function getMessageAttachmentUrl(
  client: SupabaseClient<Database>,
  path: string,
): Promise<string> {
  const { data, error } = await client.storage
    .from(MESSAGE_ATTACHMENT_BUCKET)
    .createSignedUrl(path, 10 * 60);
  if (error) throw new Error('MESSAGE_ATTACHMENT_READ');
  return data.signedUrl;
}

export function getFrenchAttachmentError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'MESSAGE_ATTACHMENT_TYPE') {
    return 'Choisissez une image JPEG, PNG ou WebP, un PDF ou un fichier texte.';
  }
  if (code === 'MESSAGE_ATTACHMENT_SIZE') {
    return 'La pièce jointe doit peser au maximum 10 Mio.';
  }
  if (code === 'MESSAGE_ATTACHMENT_READ') {
    return 'La pièce jointe privée ne peut pas être ouverte pour le moment.';
  }
  return 'La pièce jointe n’a pas pu être envoyée. Réessayez.';
}
