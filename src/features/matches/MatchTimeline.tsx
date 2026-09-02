import { CheckCircle2, CircleAlert, Clock3 } from 'lucide-react';

import type { MatchEvent } from '@/features/matches/matchSchemas';

function eventLabel(event: MatchEvent): string {
  if (event.type === 'talent_assigned') return 'Candidature acceptée';
  if (event.type === 'work_started') return 'Mission démarrée';
  if (event.type === 'progress_updated') return 'Note d’avancement';
  if (event.type === 'delivery_submitted') return 'Livraison ajoutée';
  if (event.type === 'completion_confirmed') return 'Fin confirmée';
  if (event.type === 'completion_disputed') return 'Fin contestée';
  if (event.type === 'mission_completed') return 'Mission clôturée';
  if (event.type === 'mission_cancelled') return 'Mission annulée';
  if (event.type === 'selection_started') return 'Sélection démarrée';
  if (event.type === 'mission_published') return 'Mission publiée';
  if (event.type === 'mission_created') return 'Mission créée';
  if (event.type === 'agreement_updated') {
    const action = event.metadata.action;
    if (action === 'agreement_created') return 'Accord à confirmer';
    if (action === 'agreement_activated') return 'Accord activé';
    if (action === 'agreement_completed') return 'Accord clôturé';
    if (action === 'agreement_confirmed') {
      return event.newValues?.status === 'confirmed'
        ? 'Accord confirmé par les deux participants'
        : 'Confirmation de l’accord enregistrée';
    }
    return 'Accord mis à jour';
  }
  return 'Événement de mission';
}

function eventNote(event: MatchEvent): string | null {
  const note = event.metadata.note;
  if (typeof note === 'string' && note.trim()) return note;
  const reason = event.metadata.reason;
  if (typeof reason === 'string' && reason.trim()) return `Motif : ${reason}`;
  return null;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function MatchTimeline({ events }: { events: MatchEvent[] }) {
  if (!events.length) {
    return (
      <p className="inline-empty">
        Aucun événement réel n’a encore été enregistré.
      </p>
    );
  }

  return (
    <ol className="match-timeline" aria-label="Suivi réel de la mission">
      {events.map((event) => {
        const note = eventNote(event);
        const Icon =
          event.type === 'mission_cancelled' ||
          event.type === 'completion_disputed'
            ? CircleAlert
            : event.type === 'mission_completed'
              ? CheckCircle2
              : Clock3;
        return (
          <li key={event.id}>
            <span className="match-timeline-icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <div>
              <div className="match-timeline-heading">
                <strong>{eventLabel(event)}</strong>
                <time dateTime={event.createdAt}>
                  {formatDate(event.createdAt)}
                </time>
              </div>
              {event.actorDisplayName ? (
                <p>Par {event.actorDisplayName}</p>
              ) : null}
              {note ? <p className="preserve-lines">{note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
