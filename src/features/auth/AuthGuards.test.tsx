import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/AuthGuards';
import type { AuthState } from '@/types/auth';

const mockedAuth = vi.hoisted(() => ({ current: {} as AuthState }));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => mockedAuth.current,
}));

function LocationProbe() {
  const location = useLocation();
  return <p>{location.pathname}</p>;
}

function state(overrides: Partial<AuthState>): AuthState {
  return {
    configured: true,
    configurationIssue: null,
    profile: null,
    profileStatus: 'ready',
    refreshProfile: vi.fn(),
    session: null,
    status: 'anonymous',
    user: null,
    ...overrides,
  };
}

function renderProtected(path = '/espace') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <ProtectedRoute>
              <h1>Espace protégé</h1>
            </ProtectedRoute>
          }
          path="/espace"
        />
        <Route element={<LocationProbe />} path="/connexion" />
        <Route element={<LocationProbe />} path="/onboarding" />
      </Routes>
    </MemoryRouter>,
  );
}

describe('gardes Auth et onboarding', () => {
  beforeEach(() => {
    mockedAuth.current = state({});
  });

  it('redirige un visiteur vers la connexion', () => {
    renderProtected();
    expect(screen.getByText('/connexion')).toBeVisible();
  });

  it('redirige une session avec onboarding incomplet vers l’onboarding', () => {
    mockedAuth.current = state({
      status: 'authenticated',
      user: { email: 'test@example.test', emailConfirmed: true, id: 'user-1' },
    });
    renderProtected();
    expect(screen.getByText('/onboarding')).toBeVisible();
  });

  it('ouvre la route protégée lorsque l’onboarding est terminé', () => {
    mockedAuth.current = state({
      profile: {
        avatarPath: null,
        displayName: 'Camille',
        id: 'user-1',
        onboardingCompleted: true,
        username: 'camille',
      },
      status: 'authenticated',
      user: { email: 'test@example.test', emailConfirmed: true, id: 'user-1' },
    });
    renderProtected();
    expect(
      screen.getByRole('heading', { name: 'Espace protégé' }),
    ).toBeVisible();
  });

  it('évite de renvoyer une session complète vers la connexion', () => {
    mockedAuth.current = state({
      profile: {
        avatarPath: null,
        displayName: 'Camille',
        id: 'user-1',
        onboardingCompleted: true,
        username: 'camille',
      },
      status: 'authenticated',
      user: { email: 'test@example.test', emailConfirmed: true, id: 'user-1' },
    });
    render(
      <MemoryRouter initialEntries={['/connexion']}>
        <Routes>
          <Route
            element={
              <PublicOnlyRoute>
                <h1>Connexion</h1>
              </PublicOnlyRoute>
            }
            path="/connexion"
          />
          <Route element={<LocationProbe />} path="/espace" />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('/espace')).toBeVisible();
  });
});
