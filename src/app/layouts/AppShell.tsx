import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import {
  DesktopAppNavigation,
  MobileAppNavigation,
} from '@/components/navigation/AppNavigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { getFrenchAuthError } from '@/features/auth/authErrors';
import { getSupabaseClient } from '@/lib/supabase/client';

export function AppShell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setIsSigningOut(true);
    const { error } = await client.auth.signOut();
    setIsSigningOut(false);
    if (error) {
      notify({
        description: getFrenchAuthError(error, 'logout'),
        title: 'Déconnexion impossible',
        tone: 'danger',
      });
      return;
    }
    navigate('/connexion', { replace: true });
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenu">
        Aller au contenu principal
      </a>
      <DesktopAppNavigation />
      <div className="app-workspace">
        <header className="app-topbar">
          <div>
            <Badge tone="success">Session active</Badge>
            <p>{auth.profile?.displayName ?? auth.user?.email}</p>
          </div>
          <div className="app-topbar-actions">
            <Link
              className="button button-primary"
              to={
                auth.profile?.canHire
                  ? '/espace/missions/nouvelle'
                  : '/espace/profil#capacites'
              }
            >
              {auth.profile?.canHire
                ? 'Publier une mission'
                : 'Activer la publication'}
            </Link>
            <Button
              isLoading={isSigningOut}
              onClick={() => void signOut()}
              variant="secondary"
            >
              <LogOut aria-hidden="true" size={18} /> Déconnexion
            </Button>
          </div>
        </header>
        <main className="app-main" id="contenu" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <MobileAppNavigation />
    </div>
  );
}
