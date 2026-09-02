import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
} from '@/components/ui';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRealtimeResource } from '@/features/conversations/useRealtimeResource';
import {
  getFrenchNotificationError,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationQueryKeys,
} from '@/features/notifications/notificationApi';
import { getSupabaseClient } from '@/lib/supabase/client';

const notificationLabels = {
  agreement_updated: 'Accord',
  application_received: 'Candidature',
  application_status_changed: 'Candidature',
  match_created: 'Match',
  mission_status_changed: 'Mission',
  moderation_updated: 'Signalement',
  new_message: 'Message',
  review_received: 'Avis',
} as const;

export function NotificationsPage() {
  const client = getSupabaseClient();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const notificationsQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => listNotifications(client!, page),
    queryKey: notificationQueryKeys.list(page),
    refetchInterval: 30_000,
  });
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
  }, [queryClient]);
  const realtimeState = useRealtimeResource({
    client,
    filter: auth.user ? `recipient_id=eq.${auth.user.id}` : '',
    onChange: invalidate,
    scope: auth.user?.id ?? 'anonymous',
    table: 'notifications',
  });
  const readMutation = useMutation({
    mutationFn: async (notificationId?: string) => {
      if (!client) throw new Error('SUPABASE_UNCONFIGURED');
      if (notificationId) await markNotificationRead(client, notificationId);
      else await markAllNotificationsRead(client);
    },
    onSuccess: invalidate,
  });

  if (notificationsQuery.isLoading) {
    return <Skeleton label="Chargement des notifications" lines={9} />;
  }
  if (notificationsQuery.isError) {
    return (
      <ErrorState
        action={{
          label: 'Réessayer',
          onClick: () => void notificationsQuery.refetch(),
        }}
        description={getFrenchNotificationError()}
        title="Les notifications ne peuvent pas être chargées"
      />
    );
  }

  const items = notificationsQuery.data?.items ?? [];
  const unread = items.filter(({ readAt }) => !readAt).length;
  return (
    <section className="notifications-page">
      <header className="applications-heading notifications-heading">
        <div>
          <p className="eyebrow">Événements réels</p>
          <h1>Notifications</h1>
          <p>
            Chaque alerte provient d’une action persistée et mène uniquement
            vers une ressource interne autorisée.
          </p>
          <span className="realtime-state" role="status">
            {realtimeState === 'subscribed'
              ? 'Mises à jour en temps réel actives'
              : 'Actualisation périodique active'}
          </span>
        </div>
        {unread ? (
          <Button
            isLoading={readMutation.isPending}
            onClick={() => readMutation.mutate(undefined)}
            variant="secondary"
          >
            <CheckCheck aria-hidden="true" size={18} /> Tout marquer comme lu
          </Button>
        ) : null}
      </header>
      {readMutation.isError ? (
        <p className="field-error" role="alert">
          {getFrenchNotificationError()}
        </p>
      ) : null}
      {!items.length ? (
        <EmptyState
          description="Les candidatures, matches, messages, accords et changements de mission apparaîtront ici lorsqu’ils se produiront réellement."
          icon={<Bell />}
          title="Aucune notification"
        />
      ) : (
        <div className="notification-list" role="list">
          {items.map((notification) => (
            <Card
              className={
                notification.readAt
                  ? 'notification-card'
                  : 'notification-card is-unread'
              }
              key={notification.id}
            >
              <div>
                <div className="notification-meta">
                  <Badge tone={notification.readAt ? 'neutral' : 'primary'}>
                    {notificationLabels[notification.type]}
                  </Badge>
                  <time dateTime={notification.createdAt}>
                    {new Intl.DateTimeFormat('fr-FR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(notification.createdAt))}
                  </time>
                </div>
                <h2>{notification.title}</h2>
                <p>{notification.body}</p>
              </div>
              <div className="notification-actions">
                {!notification.readAt ? (
                  <Button
                    onClick={() => readMutation.mutate(notification.id)}
                    size="sm"
                    variant="quiet"
                  >
                    Marquer comme lu
                  </Button>
                ) : null}
                <Link
                  className="button button-secondary"
                  onClick={() => {
                    if (!notification.readAt)
                      readMutation.mutate(notification.id);
                  }}
                  to={notification.internalPath}
                >
                  Ouvrir <ExternalLink aria-hidden="true" size={16} />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
      {(notificationsQuery.data?.total ?? 0) > 20 ? (
        <Pagination
          currentPage={page}
          disabled={notificationsQuery.isFetching}
          onPageChange={setPage}
          totalPages={Math.ceil(notificationsQuery.data!.total / 20)}
        />
      ) : null}
    </section>
  );
}
