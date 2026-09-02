import { Menu } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { Dropdown } from '@/components/ui/Dropdown';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/cn';
import { useAuth } from '@/app/providers/AuthProvider';

const publicLinks = [
  { label: 'Fonctionnement', to: '/fonctionnement' },
  { label: 'Règles', to: '/regles-communaute' },
  { label: 'Contact', to: '/contact' },
] as const;

export function PublicHeader() {
  const navigate = useNavigate();
  const auth = useAuth();
  const authenticated = auth.status === 'authenticated';

  return (
    <header className="public-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="SkillMatch, accueil">
          <span aria-hidden="true">S</span>
          SkillMatch
        </Link>
        <nav className="desktop-navigation" aria-label="Navigation publique">
          {publicLinks.map((item) => (
            <NavLink
              className={({ isActive }) =>
                cn('nav-link', isActive && 'is-active')
              }
              key={item.to}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          {authenticated ? (
            <Link className="button button-primary header-signup" to="/espace">
              Mon espace
            </Link>
          ) : (
            <>
              <Link
                className="button button-quiet header-login"
                to="/connexion"
              >
                Connexion
              </Link>
              <Link
                className="button button-primary header-signup"
                to="/inscription"
              >
                Créer un compte
              </Link>
            </>
          )}
          <span className="mobile-menu-trigger">
            <Dropdown
              items={[
                ...publicLinks.map((item) => ({
                  label: item.label,
                  onSelect: () => navigate(item.to),
                })),
                ...(authenticated
                  ? [
                      {
                        label: 'Mon espace',
                        onSelect: () => navigate('/espace'),
                      },
                    ]
                  : [
                      {
                        label: 'Connexion',
                        onSelect: () => navigate('/connexion'),
                      },
                      {
                        label: 'Créer un compte',
                        onSelect: () => navigate('/inscription'),
                      },
                    ]),
              ]}
              label="Ouvrir le menu"
              trigger={
                <IconButton label="Ouvrir le menu">
                  <Menu aria-hidden="true" size={21} />
                </IconButton>
              }
            />
          </span>
        </div>
      </div>
    </header>
  );
}
