import type { AuthError } from '@supabase/supabase-js';

type AuthAction =
  | 'login'
  | 'signup'
  | 'reset-request'
  | 'password-update'
  | 'callback'
  | 'logout';

interface ErrorLike {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
}

export function getFrenchAuthError(
  error: AuthError | ErrorLike | unknown,
  action: AuthAction,
): string {
  const candidate =
    typeof error === 'object' && error !== null
      ? (error as ErrorLike)
      : undefined;
  const code = candidate?.code?.toLowerCase();
  const message = candidate?.message?.toLowerCase() ?? '';

  if (
    candidate?.name === 'TypeError' ||
    message.includes('failed to fetch') ||
    message.includes('network')
  ) {
    return 'Connexion au service impossible. Vérifiez votre accès réseau puis réessayez.';
  }

  if (code === 'invalid_credentials' || message.includes('invalid login')) {
    return 'Adresse e-mail ou mot de passe incorrect.';
  }
  if (
    code === 'email_not_confirmed' ||
    message.includes('email not confirmed')
  ) {
    return 'Confirmez votre adresse e-mail avant de vous connecter.';
  }
  if (
    code === 'user_already_exists' ||
    message.includes('already registered') ||
    message.includes('already exists')
  ) {
    return 'Un compte utilise déjà cette adresse e-mail. Essayez de vous connecter.';
  }
  if (code === 'weak_password' || message.includes('password')) {
    return action === 'login'
      ? 'Adresse e-mail ou mot de passe incorrect.'
      : 'Ce mot de passe ne respecte pas les règles de sécurité.';
  }
  if (code === 'over_email_send_rate_limit' || candidate?.status === 429) {
    return 'Trop de demandes ont été envoyées. Patientez quelques minutes avant de réessayer.';
  }
  if (code === 'same_password') {
    return 'Choisissez un mot de passe différent de l’ancien.';
  }

  const fallbacks: Record<AuthAction, string> = {
    callback:
      'Le lien n’a pas pu être validé. Demandez un nouveau message et réessayez.',
    login: 'La connexion a échoué. Réessayez dans un instant.',
    logout: 'La déconnexion a échoué. Réessayez dans un instant.',
    'password-update':
      'Le mot de passe n’a pas pu être modifié. Réessayez dans un instant.',
    'reset-request':
      'La demande n’a pas pu être envoyée. Réessayez dans un instant.',
    signup: 'L’inscription a échoué. Réessayez dans un instant.',
  };
  return fallbacks[action];
}
