import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.generated';

type NotificationRow =
  Database['public']['Functions']['list_notifications']['Returns'][number];

export interface NotificationItem {
  body: string;
  createdAt: string;
  id: string;
  internalPath: string;
  readAt: string | null;
  title: string;
  total: number;
  type: Database['public']['Enums']['notification_type'];
}

export const notificationQueryKeys = {
  all: ['notifications'] as const,
  list: (page: number) => ['notifications', 'list', page] as const,
};

export async function listNotifications(
  client: SupabaseClient<Database>,
  page: number,
): Promise<{ items: NotificationItem[]; total: number }> {
  const { data, error } = await client.rpc('list_notifications', {
    p_page: page,
    p_page_size: 20,
  });
  if (error) throw error;
  const items = data.map((row: NotificationRow) => ({
    body: row.body,
    createdAt: row.created_at,
    id: row.notification_id,
    internalPath: row.internal_path,
    readAt: row.read_at ?? null,
    title: row.title,
    total: Number(row.total_count ?? 0),
    type: row.type,
  }));
  return { items, total: items[0]?.total ?? 0 };
}

export async function markNotificationRead(
  client: SupabaseClient<Database>,
  notificationId: string,
): Promise<void> {
  const { error } = await client.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });
  if (error) throw error;
}

export async function markAllNotificationsRead(
  client: SupabaseClient<Database>,
): Promise<void> {
  const { error } = await client.rpc('mark_all_notifications_read');
  if (error) throw error;
}

export function getFrenchNotificationError(): string {
  return 'Les notifications ne peuvent pas être actualisées. Réessayez.';
}
