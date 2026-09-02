import type {
  ApplicationItem,
  ApplicationStatus,
} from '@/features/applications/applicationApi';

const statusLabels: Record<ApplicationStatus, string> = {
  accepted: 'Acceptée',
  rejected: 'Refusée',
  shortlisted: 'Présélectionnée',
  submitted: 'Envoyée',
  viewed: 'Consultée',
  withdrawn: 'Retirée',
};

export function formatApplicationStatus(status: ApplicationStatus): string {
  return statusLabels[status];
}

export function formatProposal(application: ApplicationItem): string {
  if (application.proposedAmount === null) return 'Aucune proposition';
  const amount = new Intl.NumberFormat('fr-FR', {
    currency: application.proposedCurrencyCode,
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(application.proposedAmount);
  return `${amount}${application.mission.budgetModel === 'hourly' ? ' / heure' : ''} · proposition informative`;
}

export function formatApplicationDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function canWithdraw(status: ApplicationStatus): boolean {
  return ['submitted', 'viewed', 'shortlisted'].includes(status);
}

export function canReview(status: ApplicationStatus): boolean {
  return ['submitted', 'viewed', 'shortlisted'].includes(status);
}
