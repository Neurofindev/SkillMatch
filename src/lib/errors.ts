export type UserErrorKind =
  'network' | 'permission' | 'validation' | 'not-found' | 'unknown';

export class AppError extends Error {
  readonly kind: UserErrorKind;

  constructor(message: string, kind: UserErrorKind = 'unknown') {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
  }
}

const fallbackMessages: Record<UserErrorKind, string> = {
  network: 'La connexion semble interrompue. Réessayez dans un instant.',
  permission: 'Vous n’avez pas l’autorisation d’effectuer cette action.',
  validation: 'Certaines informations doivent être corrigées.',
  'not-found': 'La ressource demandée est introuvable.',
  unknown: 'Une erreur inattendue est survenue. Vous pouvez réessayer.',
};

export function getUserErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return fallbackMessages.unknown;
}

export function getUserErrorFallback(kind: UserErrorKind): string {
  return fallbackMessages[kind];
}
