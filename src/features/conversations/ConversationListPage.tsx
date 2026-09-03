import { useQuery } from '@tanstack/react-query';
import { Archive, MessageCircle, Paperclip, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Pagination,
  Skeleton,
  Tabs,
} from '@/components/ui';
import {
  conversationQueryKeys,
  getFrenchConversationError,
  listConversations,
  type ConversationListItem,
} from '@/features/conversations/conversationApi';
import { getAvatarPublicUrl } from '@/features/profiles/avatar';
import { getSupabaseClient } from '@/lib/supabase/client';

const pageSize = 20;

function ConversationCards({ items }: { items: ConversationListItem[] }) {
  const client = getSupabaseClient();
  return (
    <div className="conversation-list" role="list">
      {items.map((conversation) => {
        const avatarUrl = client
          ? getAvatarPublicUrl(client, conversation.counterpart.avatarPath)
          : undefined;
        return (
          <Card
            className={
              conversation.unreadCount
                ? 'conversation-card is-unread'
                : 'conversation-card'
            }
            key={conversation.id}
          >
            <Link to={`/espace/messages/${conversation.id}`}>
              <Avatar
                name={conversation.counterpart.displayName}
                size="sm"
                {...(avatarUrl ? { src: avatarUrl } : {})}
              />
              <div className="conversation-card-content">
                <div className="conversation-card-heading">
                  <strong>{conversation.counterpart.displayName}</strong>
                  {conversation.lastMessage.createdAt ? (
                    <time dateTime={conversation.lastMessage.createdAt}>
                      {new Intl.DateTimeFormat('fr-FR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(conversation.lastMessage.createdAt))}
                    </time>
                  ) : null}
                </div>
                <span className="conversation-mission-title">
                  {conversation.mission.title}
                </span>
                <p>
                  {conversation.lastMessage.attachmentName ? (
                    <Paperclip aria-hidden="true" size={15} />
                  ) : null}
                  {conversation.lastMessage.body ??
                    'Aucun message. Vous pouvez commencer l’échange.'}
                </p>
              </div>
              {conversation.unreadCount ? (
                <Badge tone="primary">
                  {conversation.unreadCount} non lu
                  {conversation.unreadCount > 1 ? 's' : ''}
                </Badge>
              ) : null}
            </Link>
          </Card>
        );
      })}
    </div>
  );
}

export function ConversationListPage() {
  const client = getSupabaseClient();
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const conversationsQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () =>
      listConversations(client!, {
        archived,
        page,
        query: deferredQuery,
      }),
    queryKey: conversationQueryKeys.list(archived, deferredQuery, page),
    refetchInterval: 30_000,
  });

  const listContent = conversationsQuery.isLoading ? (
    <Skeleton label="Chargement des conversations" lines={8} />
  ) : conversationsQuery.isError ? (
    <ErrorState
      action={{
        label: 'Réessayer',
        onClick: () => void conversationsQuery.refetch(),
      }}
      description={getFrenchConversationError(conversationsQuery.error)}
      title="Les conversations ne peuvent pas être chargées"
    />
  ) : !(conversationsQuery.data?.items.length ?? 0) ? (
    <EmptyState
      description={
        deferredQuery
          ? 'Aucune conversation ne correspond à cette recherche.'
          : archived
            ? 'Les conversations que vous archivez apparaîtront ici.'
            : 'Une conversation privée apparaîtra lorsqu’un participant ouvre l’échange depuis une candidature réelle.'
      }
      icon={archived ? <Archive /> : <MessageCircle />}
      title={archived ? 'Aucune conversation archivée' : 'Aucune conversation'}
    />
  ) : (
    <>
      <ConversationCards items={conversationsQuery.data!.items} />
      {conversationsQuery.data!.total > pageSize ? (
        <Pagination
          currentPage={page}
          disabled={conversationsQuery.isFetching}
          onPageChange={setPage}
          totalPages={Math.ceil(conversationsQuery.data!.total / pageSize)}
        />
      ) : null}
    </>
  );

  return (
    <section className="conversations-page">
      <header className="applications-heading">
        <div>
          <p className="eyebrow">Échanges privés</p>
          <h1>Messages</h1>
          <p>
            Seuls les participants d’une candidature réelle peuvent lire la
            conversation. L’écriture dépend de l’état actuel de la candidature
            ou de la collaboration.
          </p>
        </div>
      </header>
      <FormField id="conversation-search" label="Rechercher une conversation">
        {(props) => (
          <span className="search-control">
            <Search aria-hidden="true" size={18} />
            <Input
              {...props}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Mission ou participant"
              value={query}
            />
          </span>
        )}
      </FormField>
      <Tabs
        items={[
          { content: listContent, label: 'Actives', value: 'active' },
          { content: listContent, label: 'Archivées', value: 'archived' },
        ]}
        label="État des conversations"
        onValueChange={(value) => {
          setArchived(value === 'archived');
          setPage(1);
        }}
        value={archived ? 'archived' : 'active'}
      />
    </section>
  );
}
