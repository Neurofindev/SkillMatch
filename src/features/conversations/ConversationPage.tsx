import { zodResolver } from '@hookform/resolvers/zod';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  Ban,
  FileText,
  Flag,
  MessageCircle,
  Paperclip,
  RotateCcw,
  Send,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogClose,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import {
  getFrenchAttachmentError,
  removeMessageAttachment,
  uploadMessageAttachment,
  validateMessageAttachment,
  type UploadedMessageAttachment,
} from '@/features/conversations/attachments';
import {
  conversationQueryKeys,
  deleteMessage,
  getConversationWorkspace,
  getFrenchConversationError,
  listMessages,
  markConversationRead,
  reportConversationParticipant,
  sendMessage,
  setConversationArchived,
  setConversationBlock,
  type ConversationMessage,
  type MessageCursor,
} from '@/features/conversations/conversationApi';
import {
  messageComposerSchema,
  reportSchema,
  type MessageComposerValues,
  type ReportValues,
} from '@/features/conversations/conversationSchemas';
import { MessageAttachmentLink } from '@/features/conversations/MessageAttachmentLink';
import {
  mergeMessages,
  type DisplayMessage,
  type PendingMessage,
} from '@/features/conversations/messageMerge';
import { useOnlineStatus } from '@/features/conversations/useOnlineStatus';
import { useRealtimeResource } from '@/features/conversations/useRealtimeResource';
import { notificationQueryKeys } from '@/features/notifications/notificationApi';
import { getAvatarPublicUrl } from '@/features/profiles/avatar';
import { ReportDialog } from '@/features/safety/ReportDialog';
import { getSupabaseClient } from '@/lib/supabase/client';

const reportReasons = {
  dangerous_activity: 'Activité dangereuse',
  harassment: 'Harcèlement',
  illegal_activity: 'Activité illégale',
  impersonation: 'Usurpation',
  other: 'Autre',
  sensitive_data: 'Demande de données sensibles',
  spam: 'Spam',
} as const;

function MessageBubble({
  canDelete,
  message,
  onDelete,
  onDiscard,
  onRetry,
  own,
}: {
  canDelete: boolean;
  message: DisplayMessage;
  onDelete: (message: ConversationMessage) => Promise<void>;
  onDiscard: (message: PendingMessage) => Promise<void>;
  onRetry: (message: PendingMessage) => void;
  own: boolean;
}) {
  const deleted = !message.pending && Boolean(message.deletedAt);
  return (
    <article className={own ? 'message-bubble is-own' : 'message-bubble'}>
      <div className="message-bubble-meta">
        <strong>
          {own ? 'Vous' : message.pending ? 'Vous' : message.authorDisplayName}
        </strong>
        <time dateTime={message.createdAt}>
          {new Intl.DateTimeFormat('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(message.createdAt))}
        </time>
      </div>
      <p className={deleted ? 'deleted-message' : 'preserve-lines'}>
        {message.body}
      </p>
      {message.attachment && !deleted ? (
        message.pending && !message.attachment.path ? (
          <span className="message-attachment-pending">
            <Paperclip aria-hidden="true" size={16} /> {message.attachment.name}
          </span>
        ) : (
          <MessageAttachmentLink
            name={message.attachment.name}
            path={message.attachment.path}
            sizeBytes={message.attachment.sizeBytes}
          />
        )
      ) : null}
      <div className="message-delivery-state">
        {message.pending ? (
          message.status === 'sending' ? (
            <span role="status">Envoi…</span>
          ) : (
            <>
              <span className="field-error" role="alert">
                {message.error ?? 'Échec de l’envoi.'}
              </span>
              <Button
                onClick={() => onRetry(message)}
                size="sm"
                variant="quiet"
              >
                <RotateCcw aria-hidden="true" size={15} /> Réessayer
              </Button>
              <Button
                onClick={() => void onDiscard(message)}
                size="sm"
                variant="quiet"
              >
                <X aria-hidden="true" size={15} /> Retirer
              </Button>
            </>
          )
        ) : own && !deleted ? (
          <>
            <span>Envoyé</span>
            {canDelete ? (
              <ConfirmDialog
                confirmLabel="Supprimer le message"
                description="Le contenu sera remplacé par la mention « Message supprimé » pour les deux participants."
                onConfirm={() => onDelete(message)}
                title="Supprimer ce message ?"
                trigger={
                  <Button size="sm" variant="quiet">
                    <Trash2 aria-hidden="true" size={15} /> Supprimer
                  </Button>
                }
                variant="danger"
              />
            ) : null}
          </>
        ) : !deleted ? (
          <ReportDialog
            label="Signaler ce message"
            targetId={message.id}
            targetLabel="ce message"
            targetType="message"
          />
        ) : null}
      </div>
    </article>
  );
}

export function ConversationPage() {
  const { conversationId = '' } = useParams();
  const client = getSupabaseClient();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const viewportRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [actionError, setActionError] = useState('');
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const composerForm = useForm<MessageComposerValues>({
    defaultValues: { body: '' },
    resolver: zodResolver(messageComposerSchema),
  });
  const reportForm = useForm<ReportValues>({
    defaultValues: { description: '', reason: 'spam' },
    resolver: zodResolver(reportSchema),
  });

  const workspaceQuery = useQuery({
    enabled: Boolean(client && conversationId),
    queryFn: () => getConversationWorkspace(client!, conversationId),
    queryKey: conversationQueryKeys.detail(conversationId),
  });
  const messagesQuery = useInfiniteQuery({
    enabled: Boolean(client && conversationId),
    getNextPageParam: (lastPage) => {
      const page = lastPage as ConversationMessage[];
      if (page.length < 30) return undefined;
      const oldest = page.at(-1);
      return oldest
        ? { createdAt: oldest.createdAt, id: oldest.id }
        : undefined;
    },
    initialPageParam: null as MessageCursor | null,
    queryFn: ({ pageParam }) =>
      listMessages(client!, conversationId, pageParam ?? undefined),
    queryKey: conversationQueryKeys.messages(conversationId),
    refetchInterval: 15_000,
  });

  const invalidateConversation = useCallback(() => {
    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.messages(conversationId),
      }),
      queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.detail(conversationId),
      }),
      queryClient.invalidateQueries({ queryKey: conversationQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all }),
    ]);
  }, [conversationId, queryClient]);
  const handleRealtimeChange = useCallback(() => {
    setLiveAnnouncement('Nouveau message reçu.');
    invalidateConversation();
  }, [invalidateConversation]);
  const realtimeState = useRealtimeResource({
    client,
    filter: conversationId ? `conversation_id=eq.${conversationId}` : '',
    onChange: handleRealtimeChange,
    scope: conversationId,
    table: 'messages',
  });

  const persistedMessages =
    messagesQuery.data?.pages.flatMap(
      (page) => page as ConversationMessage[],
    ) ?? [];
  const messages = mergeMessages(persistedMessages, pendingMessages);

  useEffect(() => {
    if (!client || !conversationId || !persistedMessages.length) return;
    void markConversationRead(client, conversationId).then(() => {
      void queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.all,
      });
    });
  }, [client, conversationId, persistedMessages.length, queryClient]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (!initialScrollDoneRef.current || stickToBottomRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
      initialScrollDoneRef.current = true;
    }
  }, [messages.length]);

  const runSend = async (pending: PendingMessage) => {
    if (!client || !auth.user) return;
    const sending = { ...pending, error: null, status: 'sending' as const };
    setPendingMessages((current) =>
      current.map((item) =>
        item.clientMessageId === sending.clientMessageId ? sending : item,
      ),
    );
    try {
      const attachment =
        sending.file && !sending.attachment?.path
          ? await uploadMessageAttachment(
              client,
              conversationId,
              auth.user.id,
              sending.clientMessageId,
              sending.file,
            )
          : sending.attachment;
      const ready = { ...sending, attachment };
      setPendingMessages((current) =>
        current.map((item) =>
          item.clientMessageId === ready.clientMessageId ? ready : item,
        ),
      );
      try {
        await sendMessage(client, {
          ...(ready.attachment ? { attachment: ready.attachment } : {}),
          body: ready.body,
          clientMessageId: ready.clientMessageId,
          conversationId,
        });
        setPendingMessages((current) =>
          current.filter(
            (item) => item.clientMessageId !== ready.clientMessageId,
          ),
        );
        invalidateConversation();
      } catch (error) {
        setPendingMessages((current) =>
          current.map((item) =>
            item.clientMessageId === ready.clientMessageId
              ? {
                  ...ready,
                  error: getFrenchConversationError(error),
                  status: 'failed',
                }
              : item,
          ),
        );
      }
    } catch (error) {
      setPendingMessages((current) =>
        current.map((item) =>
          item.clientMessageId === sending.clientMessageId
            ? {
                ...sending,
                error: getFrenchAttachmentError(error),
                status: 'failed',
              }
            : item,
        ),
      );
    }
  };

  const deletePersistedMessage = async (message: ConversationMessage) => {
    if (!client) return;
    setActionError('');
    try {
      const attachmentPath = await deleteMessage(client, message.id);
      if (attachmentPath) {
        await removeMessageAttachment(client, attachmentPath).catch(
          () => undefined,
        );
      }
      invalidateConversation();
    } catch (error) {
      setActionError(getFrenchConversationError(error));
      throw error;
    }
  };

  const discardPending = async (pending: PendingMessage) => {
    if (client && pending.attachment?.path) {
      await removeMessageAttachment(client, pending.attachment.path).catch(
        () => undefined,
      );
    }
    setPendingMessages((current) =>
      current.filter(
        ({ clientMessageId }) => clientMessageId !== pending.clientMessageId,
      ),
    );
  };

  const workspaceMutation = useMutation({
    mutationFn: async (
      action:
        | { type: 'archive'; archived: boolean }
        | { type: 'block'; blocked: boolean }
        | { type: 'report'; values: ReportValues },
    ) => {
      if (!client) throw new Error('SUPABASE_UNCONFIGURED');
      if (action.type === 'archive') {
        await setConversationArchived(client, conversationId, action.archived);
      } else if (action.type === 'block') {
        await setConversationBlock(client, conversationId, action.blocked);
      } else {
        await reportConversationParticipant(
          client,
          conversationId,
          action.values,
        );
      }
      return action;
    },
    onError: (error) => setActionError(getFrenchConversationError(error)),
    onMutate: () => setActionError(''),
    onSuccess: (action) => {
      invalidateConversation();
      if (action.type === 'archive') navigate('/espace/messages');
      if (action.type === 'report') {
        setReportOpen(false);
        reportForm.reset();
      }
    },
  });

  if (workspaceQuery.isLoading || messagesQuery.isLoading) {
    return <Skeleton label="Chargement de la conversation" lines={12} />;
  }
  if (workspaceQuery.isError || messagesQuery.isError) {
    const error = workspaceQuery.error ?? messagesQuery.error;
    const message = getFrenchConversationError(error);
    return (
      <ErrorState
        action={{
          label: 'Réessayer',
          onClick: () => {
            void workspaceQuery.refetch();
            void messagesQuery.refetch();
          },
        }}
        description={message}
        title={
          message.includes('autorisé')
            ? 'Accès non autorisé'
            : 'Conversation indisponible'
        }
      />
    );
  }
  if (!workspaceQuery.data) {
    return (
      <EmptyState
        description="Cette conversation a été supprimée ou n’existe plus."
        title="Ressource introuvable"
      />
    );
  }

  const workspace = workspaceQuery.data;
  const avatarUrl = client
    ? getAvatarPublicUrl(client, workspace.counterpart.avatarPath)
    : undefined;
  const canCompose = workspace.conversation.canSend && online;

  return (
    <section className="conversation-page">
      <Link className="back-link" to="/espace/messages">
        <ArrowLeft aria-hidden="true" size={18} /> Retour aux messages
      </Link>
      <header className="conversation-heading">
        <div className="conversation-person">
          <Avatar
            name={workspace.counterpart.displayName}
            {...(avatarUrl ? { src: avatarUrl } : {})}
          />
          <div>
            <h1>{workspace.counterpart.displayName}</h1>
            <p>
              @{workspace.counterpart.username} · {workspace.mission.title}
            </p>
            <span className="realtime-state" role="status">
              {realtimeState === 'subscribed'
                ? 'Temps réel actif'
                : 'Actualisation périodique active'}
            </span>
          </div>
        </div>
        <div className="conversation-header-actions">
          <Dialog
            description="Seules les informations publiques autorisées sont affichées."
            title={`Profil de ${workspace.counterpart.displayName}`}
            trigger={
              <Button variant="secondary">
                <UserRound aria-hidden="true" size={18} /> Profil public
              </Button>
            }
          >
            <div className="public-profile-dialog">
              <p>
                {workspace.counterpart.headline ??
                  'Aucune headline renseignée.'}
              </p>
              <p>
                {workspace.counterpart.bio ?? 'Aucune bio publique renseignée.'}
              </p>
              <dl>
                <div>
                  <dt>Zone approximative</dt>
                  <dd>
                    {[
                      workspace.counterpart.city,
                      workspace.counterpart.countryCode,
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Non publiée'}
                  </dd>
                </div>
                <div>
                  <dt>À distance</dt>
                  <dd>
                    {workspace.counterpart.remoteAvailable ? 'Oui' : 'Non'}
                  </dd>
                </div>
              </dl>
            </div>
          </Dialog>
          <Link
            className="button button-secondary"
            to={`/espace/missions/${workspace.mission.id}`}
          >
            <FileText aria-hidden="true" size={18} /> Mission
          </Link>
          {workspace.match ? (
            <Link
              className="button button-secondary"
              to={`/espace/matches/${workspace.match.id}`}
            >
              Accord et suivi
            </Link>
          ) : (
            <Link
              className="button button-secondary"
              to={`/espace/candidatures/${workspace.application.id}`}
            >
              Candidature
            </Link>
          )}
        </div>
      </header>

      <div className="conversation-safety-bar">
        <ConfirmDialog
          confirmLabel={
            workspace.conversation.blockedByMe ? 'Débloquer' : 'Bloquer'
          }
          description={
            workspace.conversation.blockedByMe
              ? 'Les deux participants pourront de nouveau écrire si aucun autre blocage n’existe.'
              : 'L’historique reste visible, mais la base refusera tout nouveau message dans les deux sens.'
          }
          onConfirm={() =>
            workspaceMutation.mutateAsync({
              blocked: !workspace.conversation.blockedByMe,
              type: 'block',
            })
          }
          title={
            workspace.conversation.blockedByMe
              ? 'Débloquer ce participant ?'
              : 'Bloquer ce participant ?'
          }
          trigger={
            <Button variant="quiet">
              <Ban aria-hidden="true" size={17} />
              {workspace.conversation.blockedByMe ? 'Débloquer' : 'Bloquer'}
            </Button>
          }
          variant={workspace.conversation.blockedByMe ? 'primary' : 'danger'}
        />
        <Button onClick={() => setReportOpen(true)} variant="quiet">
          <Flag aria-hidden="true" size={17} /> Signaler
        </Button>
        <ConfirmDialog
          confirmLabel="Archiver"
          description="La conversation quittera la liste active. Un nouveau message réel la fera réapparaître."
          onConfirm={() =>
            workspaceMutation.mutateAsync({ archived: true, type: 'archive' })
          }
          title="Archiver cette conversation ?"
          trigger={
            <Button variant="quiet">
              <Archive aria-hidden="true" size={17} /> Archiver
            </Button>
          }
        />
      </div>

      {actionError ? (
        <p className="field-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {!online ? (
        <div className="status-banner status-banner-warning" role="status">
          Vous êtes hors ligne. L’historique déjà chargé reste lisible, mais
          l’envoi est suspendu.
        </div>
      ) : null}
      {workspace.conversation.isBlocked ? (
        <div className="status-banner status-banner-warning" role="status">
          <ShieldAlert aria-hidden="true" size={20} /> Un blocage empêche tout
          nouveau message. L’historique reste disponible.
        </div>
      ) : !workspace.conversation.canSend ? (
        <div className="status-banner" role="status">
          {workspace.match
            ? 'Cette collaboration est terminée ou annulée : la conversation est en lecture seule.'
            : 'Cette candidature est retirée ou refusée : la conversation reste consultable en lecture seule.'}
        </div>
      ) : null}

      <Card className="conversation-surface">
        {messagesQuery.hasNextPage ? (
          <Button
            isLoading={messagesQuery.isFetchingNextPage}
            onClick={() => {
              const viewport = viewportRef.current;
              const previousHeight = viewport?.scrollHeight ?? 0;
              void messagesQuery.fetchNextPage().then(() => {
                requestAnimationFrame(() => {
                  if (viewport) {
                    viewport.scrollTop +=
                      viewport.scrollHeight - previousHeight;
                  }
                });
              });
            }}
            variant="quiet"
          >
            Charger les messages précédents
          </Button>
        ) : null}
        <div
          aria-label="Messages de la conversation"
          className="message-list"
          onScroll={(event) => {
            const target = event.currentTarget;
            stickToBottomRef.current =
              target.scrollHeight - target.scrollTop - target.clientHeight <
              120;
          }}
          ref={viewportRef}
          role="log"
          tabIndex={0}
        >
          {!messages.length ? (
            <EmptyState
              description="Écrivez le premier message au sujet de cette candidature."
              icon={<MessageCircle />}
              title="Aucun message"
            />
          ) : (
            messages.map((message) => (
              <MessageBubble
                canDelete={workspace.conversation.canSend}
                key={message.id}
                message={message}
                onDelete={deletePersistedMessage}
                onDiscard={discardPending}
                onRetry={(pending) => void runSend(pending)}
                own={
                  message.pending ||
                  Boolean(auth.user && message.authorId === auth.user.id)
                }
              />
            ))
          )}
        </div>
        <p aria-live="polite" className="sr-only">
          {liveAnnouncement}
        </p>

        {canCompose ? (
          <form
            className="message-composer"
            onSubmit={composerForm.handleSubmit((values) => {
              const clientMessageId = crypto.randomUUID();
              const next: PendingMessage = {
                attachment: selectedFile
                  ? {
                      mimeType:
                        selectedFile.type as UploadedMessageAttachment['mimeType'],
                      name: selectedFile.name,
                      path: '',
                      sizeBytes: selectedFile.size,
                    }
                  : null,
                body: values.body,
                clientMessageId,
                createdAt: new Date().toISOString(),
                error: null,
                file: selectedFile,
                status: 'sending',
              };
              setPendingMessages((current) => [...current, next]);
              composerForm.reset();
              setSelectedFile(null);
              setAttachmentError('');
              void runSend(next);
            })}
          >
            <FormField
              error={composerForm.formState.errors.body?.message}
              id="message-body"
              label="Votre message"
              required
            >
              {(props) => (
                <Textarea
                  {...props}
                  maxLength={5000}
                  placeholder="Écrivez un message utile à la mission…"
                  {...composerForm.register('body')}
                />
              )}
            </FormField>
            <div className="message-composer-actions">
              <div>
                <label
                  className="button button-secondary"
                  htmlFor="message-attachment"
                >
                  <Paperclip aria-hidden="true" size={18} /> Ajouter un fichier
                </label>
                <Input
                  accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
                  className="sr-only"
                  id="message-attachment"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setAttachmentError('');
                    if (!file) {
                      setSelectedFile(null);
                      return;
                    }
                    try {
                      validateMessageAttachment(file);
                      setSelectedFile(file);
                    } catch (error) {
                      setSelectedFile(null);
                      setAttachmentError(getFrenchAttachmentError(error));
                      event.target.value = '';
                    }
                  }}
                  type="file"
                />
                {selectedFile ? (
                  <span className="selected-attachment">
                    {selectedFile.name}
                    <Button
                      aria-label="Retirer la pièce jointe"
                      onClick={() => setSelectedFile(null)}
                      size="sm"
                      variant="quiet"
                    >
                      <X aria-hidden="true" size={15} />
                    </Button>
                  </span>
                ) : null}
                {attachmentError ? (
                  <p className="field-error" role="alert">
                    {attachmentError}
                  </p>
                ) : null}
              </div>
              <Button type="submit">
                <Send aria-hidden="true" size={18} /> Envoyer
              </Button>
            </div>
            <p className="field-description">
              5 000 caractères maximum. Images, PDF ou texte, 10 Mio maximum.
            </p>
          </form>
        ) : null}
      </Card>

      <Dialog
        description="Le signalement est privé et sera accessible uniquement à la modération autorisée."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button
              isLoading={workspaceMutation.isPending}
              onClick={() =>
                reportForm.handleSubmit((values) =>
                  workspaceMutation.mutate({ type: 'report', values }),
                )()
              }
              variant="danger"
            >
              Envoyer le signalement
            </Button>
          </>
        }
        onOpenChange={setReportOpen}
        open={reportOpen}
        title="Signaler ce participant"
      >
        <form className="report-form">
          <FormField
            error={reportForm.formState.errors.reason?.message}
            id="report-reason"
            label="Motif"
            required
          >
            {(props) => (
              <Select {...props} {...reportForm.register('reason')}>
                {Object.entries(reportReasons).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField
            error={reportForm.formState.errors.description?.message}
            id="report-description"
            label="Description factuelle"
            required
          >
            {(props) => (
              <Textarea
                {...props}
                maxLength={3000}
                {...reportForm.register('description')}
              />
            )}
          </FormField>
        </form>
      </Dialog>
    </section>
  );
}
