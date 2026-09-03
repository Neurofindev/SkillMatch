import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  getSupabaseClient,
  getSupabaseConfigurationIssue,
  hasSupabaseConfiguration,
} from '@/lib/supabase/client';
import type { AuthProfile, AuthState, ProfileStatus } from '@/types/auth';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = hasSupabaseConfiguration();
  const client = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthState['status']>(() =>
    configured ? 'loading' : 'unconfigured',
  );
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('idle');
  const [profileRevision, setProfileRevision] = useState(0);

  useEffect(() => {
    if (!client) return;
    let active = true;
    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      if (!nextSession) {
        setProfile(null);
        setProfileStatus('idle');
      }
      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'anonymous');
    };

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    void client.auth.getSession().then(({ data: sessionData, error }) => {
      if (!active) return;
      applySession(error ? null : sessionData.session);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!client || !userId) {
      return;
    }

    let active = true;
    queueMicrotask(() => {
      if (active) setProfileStatus('loading');
    });
    void client
      .from('profiles')
      .select(
        'id, username, display_name, avatar_path, onboarding_completed, can_hire, can_work',
      )
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setProfile(null);
          setProfileStatus('error');
          return;
        }
        setProfile(
          data
            ? {
                avatarPath: data.avatar_path,
                canHire: data.can_hire,
                canWork: data.can_work,
                displayName: data.display_name,
                id: data.id,
                onboardingCompleted: data.onboarding_completed,
                username: data.username,
              }
            : null,
        );
        setProfileStatus('ready');
      });

    return () => {
      active = false;
    };
  }, [client, profileRevision, session?.user.id]);

  const refreshProfile = useCallback(() => {
    setProfileRevision((revision) => revision + 1);
  }, []);

  const value = useMemo<AuthState>(() => {
    const authUser = session?.user;
    return {
      configured,
      configurationIssue: getSupabaseConfigurationIssue(),
      profile,
      profileStatus,
      refreshProfile,
      session,
      status,
      user: authUser
        ? {
            email: authUser.email ?? '',
            emailConfirmed: Boolean(authUser.email_confirmed_at),
            id: authUser.id,
          }
        : null,
    };
  }, [configured, profile, profileStatus, refreshProfile, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider.');
  }
  return context;
}
