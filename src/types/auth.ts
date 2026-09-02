import type { Session } from '@supabase/supabase-js';

export interface AuthUser {
  emailConfirmed: boolean;
  id: string;
  email: string;
}

export interface AuthProfile {
  avatarPath: string | null;
  displayName: string;
  id: string;
  onboardingCompleted: boolean;
  username: string;
}

export type AuthStatus =
  'loading' | 'unconfigured' | 'anonymous' | 'authenticated';

export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AuthState {
  configured: boolean;
  configurationIssue: string | null;
  profile: AuthProfile | null;
  profileStatus: ProfileStatus;
  refreshProfile: () => void;
  session: Session | null;
  status: AuthStatus;
  user: AuthUser | null;
}
