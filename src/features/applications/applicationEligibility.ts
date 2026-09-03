import type { MissionSummary } from '@/features/missions/missionApi';

export type ApplicationEligibilityReason =
  | 'allowed'
  | 'deadline-passed'
  | 'mission-closed'
  | 'owner'
  | 'work-capability-required';

export interface ApplicationEligibility {
  allowed: boolean;
  description: string;
  reason: ApplicationEligibilityReason;
  title: string;
}

type ApplicationMission = Pick<
  MissionSummary,
  'applicationDeadline' | 'owner' | 'status'
>;

export function getApplicationEligibility(
  mission: ApplicationMission,
  actor: { canWork: boolean; id: string },
  currentDate = new Date().toISOString().slice(0, 10),
): ApplicationEligibility {
  if (mission.owner.id === actor.id) {
    return {
      allowed: false,
      description:
        'Le propriétaire ne peut pas candidater à sa propre mission.',
      reason: 'owner',
      title: 'Candidature impossible',
    };
  }

  if (!actor.canWork) {
    return {
      allowed: false,
      description:
        'Votre compte est configuré uniquement pour publier. Activez « trouver une mission » dans votre profil, puis revenez candidater.',
      reason: 'work-capability-required',
      title: 'Capacité talent requise',
    };
  }

  if (!['published', 'selecting'].includes(mission.status)) {
    return {
      allowed: false,
      description: 'Cette mission n’accepte plus de nouvelles candidatures.',
      reason: 'mission-closed',
      title: 'Candidature fermée',
    };
  }

  if (
    mission.applicationDeadline &&
    mission.applicationDeadline < currentDate
  ) {
    return {
      allowed: false,
      description: 'L’échéance de candidature est dépassée.',
      reason: 'deadline-passed',
      title: 'Candidature fermée',
    };
  }

  return {
    allowed: true,
    description: '',
    reason: 'allowed',
    title: '',
  };
}
