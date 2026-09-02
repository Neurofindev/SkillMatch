import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '@/app/providers/AuthProvider';

const authMocks = vi.hoisted(() => {
  const session = {
    access_token: 'not-a-real-token',
    expires_at: 2_000_000_000,
    expires_in: 3600,
    refresh_token: 'not-a-real-refresh-token',
    token_type: 'bearer',
    user: {
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-08-29T00:00:00.000Z',
      email: 'session@example.test',
      email_confirmed_at: '2026-08-29T00:00:00.000Z',
      id: 'user-session',
      user_metadata: {},
    },
  } as Session;
  const getSession = vi.fn().mockResolvedValue({
    data: { session },
    error: null,
  });
  const unsubscribe = vi.fn();
  const client = {
    auth: {
      getSession,
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              avatar_path: null,
              display_name: 'Session restaurée',
              id: 'user-session',
              onboarding_completed: true,
              username: 'session-restauree',
            },
            error: null,
          }),
        })),
      })),
    })),
  };
  return { client, getSession, unsubscribe };
});

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => authMocks.client,
  getSupabaseConfigurationIssue: () => null,
  hasSupabaseConfiguration: () => true,
}));

function AuthProbe() {
  const auth = useAuth();
  return (
    <p>
      {auth.status}:{auth.profileStatus}:
      {auth.profile?.username ?? 'sans-profil'}
    </p>
  );
}

describe('restauration de session', () => {
  it('restaure la session et le profil à chaque remontage du provider', async () => {
    const first = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    expect(
      await screen.findByText('authenticated:ready:session-restauree'),
    ).toBeVisible();
    first.unmount();

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    expect(
      await screen.findByText('authenticated:ready:session-restauree'),
    ).toBeVisible();
    await waitFor(() => expect(authMocks.getSession).toHaveBeenCalledTimes(2));
    expect(authMocks.unsubscribe).toHaveBeenCalled();
  });
});
