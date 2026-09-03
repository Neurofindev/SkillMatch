import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { UploadedMessageAttachment } from '@/features/conversations/attachments';
import {
  conversationWorkspaceSchema,
  type ConversationWorkspace,
  type ReportValues,
} from '@/features/conversations/conversationSchemas';
import type { Database } from '@/types/database.generated';

type ConversationRow =
  Database['public']['Functions']['list_conversations']['Returns'][number];
type MessageRow =
  Database['public']['Functions']['list_messages']['Returns'][number];
type SentMessageRow =
  Database['public']['Functions']['send_message']['Returns'][number];

export interface ConversationListItem {
  archivedAt: string | null;
  counterpart: {
    avatarPath: string | null;
    displayName: string;
    headline: string | null;
    id: string;
    username: string;
  };
  id: string;
  lastMessage: {
    attachmentName: string | null;
    authorId: string | null;
    body: string | null;
    createdAt: string | null;
    deletedAt: string | null;
    id: string | null;
  };
  match: {
    id: string;
    status: Database['public']['Enums']['match_status'];
  } | null;
  mission: {
    id: string;
    status: Database['public']['Enums']['mission_status'];
    title: string;
  };
  role: 'client' | 'talent';
  total: number;
  unreadCount: number;
}

export interface ConversationMessage {
  attachment: UploadedMessageAttachment | null;
  authorDisplayName: string;
  authorId: string | null;
  body: string;
  clientMessageId: string;
  createdAt: string;
  deletedAt: string | null;
  editedAt: string | null;
  id: string;
}

export interface MessageCursor {
  createdAt: string;
  id: string;
}

export const conversationQueryKeys = {
  all: ['conversations'] as const,
  detail: (id: string) => ['conversations', 'detail', id] as const,
  list: (archived: boolean, query: string, page: number) =>
    ['conversations', 'list', { archived, page, query }] as const,
  messages: (id: string) => ['conversations', 'messages', id] as const,
};

function mapConversation(row: ConversationRow): ConversationListItem {
  return {
    archivedAt: row.archived_at ?? null,
    counterpart: {
      avatarPath: row.counterpart_avatar_path ?? null,
      displayName: row.counterpart_display_name,
      headline: row.counterpart_headline ?? null,
      id: row.counterpart_id,
      username: row.counterpart_username,
    },
    id: row.conversation_id,
    lastMessage: {
      attachmentName: row.last_message_attachment_name ?? null,
      authorId: row.last_message_author_id ?? null,
      body: row.last_message_body ?? null,
      createdAt: row.last_message_at ?? null,
      deletedAt: row.last_message_deleted_at ?? null,
      id: row.last_message_id ?? null,
    },
    match:
      row.match_id && row.match_status
        ? { id: row.match_id, status: row.match_status }
        : null,
    mission: {
      id: row.mission_id,
      status: row.mission_status,
      title: row.mission_title,
    },
    role: row.participant_role === 'client' ? 'client' : 'talent',
    total: Number(row.total_count ?? 0),
    unreadCount: Number(row.unread_count ?? 0),
  };
}

function mapMessage(row: MessageRow | SentMessageRow): ConversationMessage {
  return {
    attachment:
      row.attachment_path &&
      row.attachment_name &&
      row.attachment_mime_type &&
      row.attachment_size_bytes
        ? {
            mimeType:
              row.attachment_mime_type as UploadedMessageAttachment['mimeType'],
            name: row.attachment_name,
            path: row.attachment_path,
            sizeBytes: row.attachment_size_bytes,
          }
        : null,
    authorDisplayName:
      'author_display_name' in row ? row.author_display_name : '',
    authorId: row.author_id ?? null,
    body: row.body,
    clientMessageId: row.client_message_id,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? null,
    editedAt: 'edited_at' in row ? (row.edited_at ?? null) : null,
    id: row.message_id,
  };
}

export function getFrenchConversationError(error: unknown): string {
  const candidate =
    typeof error === 'object' && error !== null
      ? (error as { code?: string; message?: string })
      : undefined;
  const message = candidate?.message?.toLowerCase() ?? '';
  if (
    error instanceof TypeError ||
    message.includes('failed to fetch') ||
    message.includes('network')
  ) {
    return 'Connexion impossible. Le message reste disponible pour un nouvel essai.';
  }
  if (candidate?.code === 'P0001' || message.includes('rate limit')) {
    return 'Vous envoyez des messages trop rapidement. Attendez quelques secondes.';
  }
  if (message.includes('block')) {
    return 'Un blocage entre les participants empêche tout nouveau message.';
  }
  if (
    message.includes('active match') ||
    message.includes('read-only') ||
    message.includes('active application')
  ) {
    return 'Cette conversation est désormais en lecture seule.';
  }
  if (candidate?.code === '42501') {
    return 'Vous n’êtes pas autorisé à accéder à cette conversation.';
  }
  if (candidate?.code === 'P0002') {
    return 'Cette conversation a été supprimée ou n’existe plus.';
  }
  if (candidate?.code === '23514' || candidate?.code === '22023') {
    return 'Le message ou sa pièce jointe ne respecte pas les limites autorisées.';
  }
  return 'L’opération de messagerie a échoué. Réessayez.';
}

export async function listConversations(
  client: SupabaseClient<Database>,
  options: { archived: boolean; page: number; query: string },
): Promise<{ items: ConversationListItem[]; total: number }> {
  const { data, error } = await client.rpc('list_conversations', {
    p_archived: options.archived,
    p_page: options.page,
    p_page_size: 20,
    ...(options.query ? { p_query: options.query } : {}),
  });
  if (error) throw error;
  const items = data.map(mapConversation);
  return { items, total: items[0]?.total ?? 0 };
}

export async function getConversationWorkspace(
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<ConversationWorkspace> {
  const { data, error } = await client.rpc('get_conversation_workspace', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return conversationWorkspaceSchema.parse(data);
}

export async function getApplicationConversationState(
  client: SupabaseClient<Database>,
  applicationId: string,
): Promise<{ canStart: boolean; conversationId: string | null }> {
  const { data, error } = await client.rpc(
    'get_application_conversation_state',
    { p_application_id: applicationId },
  );
  if (error) throw error;
  return z
    .object({
      canStart: z.boolean(),
      conversationId: z.string().uuid().nullable(),
    })
    .parse(data);
}

export async function getOrCreateApplicationConversation(
  client: SupabaseClient<Database>,
  applicationId: string,
): Promise<string> {
  const { data, error } = await client.rpc(
    'get_or_create_application_conversation',
    { p_application_id: applicationId },
  );
  if (error) throw error;
  return z.string().uuid().parse(data);
}

export async function listMessages(
  client: SupabaseClient<Database>,
  conversationId: string,
  cursor?: MessageCursor,
): Promise<ConversationMessage[]> {
  const { data, error } = await client.rpc('list_messages', {
    p_conversation_id: conversationId,
    p_page_size: 30,
    ...(cursor
      ? {
          p_before_created_at: cursor.createdAt,
          p_before_id: cursor.id,
        }
      : {}),
  });
  if (error) throw error;
  return data.map(mapMessage);
}

export async function sendMessage(
  client: SupabaseClient<Database>,
  values: {
    attachment?: UploadedMessageAttachment;
    body: string;
    clientMessageId: string;
    conversationId: string;
  },
): Promise<ConversationMessage> {
  const { data, error } = await client.rpc('send_message', {
    p_body: values.body,
    p_client_message_id: values.clientMessageId,
    p_conversation_id: values.conversationId,
    ...(values.attachment
      ? {
          p_attachment_mime_type: values.attachment.mimeType,
          p_attachment_name: values.attachment.name,
          p_attachment_path: values.attachment.path,
          p_attachment_size_bytes: values.attachment.sizeBytes,
        }
      : {}),
  });
  if (error) throw error;
  const row = data[0];
  if (!row) throw new Error('MESSAGE_SEND_EMPTY');
  return mapMessage(row);
}

export async function markConversationRead(
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<void> {
  const { error } = await client.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

export async function setConversationArchived(
  client: SupabaseClient<Database>,
  conversationId: string,
  archived: boolean,
): Promise<void> {
  const { error } = await client.rpc('set_conversation_archived', {
    p_archived: archived,
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

export async function deleteMessage(
  client: SupabaseClient<Database>,
  messageId: string,
): Promise<string | null> {
  const { data, error } = await client.rpc('delete_message', {
    p_message_id: messageId,
  });
  if (error) throw error;
  return data ?? null;
}

export async function setConversationBlock(
  client: SupabaseClient<Database>,
  conversationId: string,
  blocked: boolean,
): Promise<void> {
  const { error } = await client.rpc('set_conversation_block', {
    p_blocked: blocked,
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

export async function reportConversationParticipant(
  client: SupabaseClient<Database>,
  conversationId: string,
  values: ReportValues,
): Promise<void> {
  const { error } = await client.rpc('report_conversation_participant', {
    p_conversation_id: conversationId,
    p_description: values.description,
    p_reason: values.reason,
  });
  if (error) throw error;
}
