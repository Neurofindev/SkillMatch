import type { UploadedMessageAttachment } from '@/features/conversations/attachments';
import type { ConversationMessage } from '@/features/conversations/conversationApi';

export interface PendingMessage {
  attachment: UploadedMessageAttachment | null;
  body: string;
  clientMessageId: string;
  createdAt: string;
  error: string | null;
  file: File | null;
  status: 'failed' | 'sending';
}

export type DisplayMessage =
  | (ConversationMessage & { pending: false })
  | (PendingMessage & { id: string; pending: true });

export function mergeMessages(
  persisted: ConversationMessage[],
  pending: PendingMessage[],
): DisplayMessage[] {
  const byId = new Map<string, ConversationMessage>();
  const persistedClientIds = new Set<string>();
  for (const message of persisted) {
    byId.set(message.id, message);
    persistedClientIds.add(message.clientMessageId);
  }

  const result: DisplayMessage[] = [...byId.values()].map((message) => ({
    ...message,
    pending: false,
  }));
  for (const message of pending) {
    if (!persistedClientIds.has(message.clientMessageId)) {
      result.push({
        ...message,
        id: `pending-${message.clientMessageId}`,
        pending: true,
      });
    }
  }
  return result.sort((left, right) => {
    const dateOrder = left.createdAt.localeCompare(right.createdAt);
    return dateOrder || left.id.localeCompare(right.id);
  });
}
