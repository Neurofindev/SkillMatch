import type { ReactNode } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import { Card, ErrorState } from '@/components/ui';

function RouteLoading({ label }: { label: string }) {
  return (
    <main className="page-shell state-page" id="contenu">
      <div className="route-loading" role="status">
        <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" />
        <p>{label}</p>
      </div>
    </main>
  );
}

function ConfigurationRequired({ issue }: { issue: string | null }) {
  return (
    <main className="page-shell state-page" id="contenu">
      <Card>
        <ErrorState
          description={
            issue ??
            'Ajoutez les deux variables publiques Supabase puis redémarrez l’application.'
          }
          icon={<AlertTriangle />}
          title="Connexion Supabase non configurée"
        />
      </Card>
    </main>
  );
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.status === 'loading') {
    return <RouteLoading label="Restauration de la session…" />;
  }
  if (auth.status !== 'authenticated') return children;
  if (auth.profileStatus === 'loading' || auth.profileStatus === 'idle') {
    return <RouteLoading label="Vérification du profil…" />;
  }
  return (
    <Navigate
      replace
      to={auth.profile?.onboardingCompleted ? '/espace' : '/onboarding'}
    />
  );
}

export function ProtectedRoute({
  allowIncompleteProfile = false,
  children,
}: {
  allowIncompleteProfile?: boolean;
  children: ReactNode;
}) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'unconfigured') {
    return <ConfigurationRequired issue={auth.configurationIssue} />;
  }
  if (auth.status === 'loading') {
    return <RouteLoading label="Restauration de la session…" />;
  }
  if (auth.status === 'anonymous') {
    return (
      <Navigate replace state={{ from: location.pathname }} to="/connexion" />
    );
  }
  if (auth.profileStatus === 'loading' || auth.profileStatus === 'idle') {
    return <RouteLoading label="Chargement du profil…" />;
  }
  if (auth.profileStatus === 'error') {
    return (
      <main className="page-shell state-page" id="contenu">
        <ErrorState
          action={{ label: 'Réessayer', onClick: auth.refreshProfile }}
          description="Le profil n’a pas pu être chargé. Vérifiez votre connexion."
          title="Profil indisponible"
        />
      </main>
    );
  }
  if (!allowIncompleteProfile && !auth.profile?.onboardingCompleted) {
    return <Navigate replace to="/onboarding" />;
  }
  if (allowIncompleteProfile && auth.profile?.onboardingCompleted) {
    return <Navigate replace to="/espace" />;
  }
  return children;
}
