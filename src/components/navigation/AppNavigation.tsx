import {
  Bell,
  Compass,
  FileUser,
  Heart,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  PanelsTopLeft,
  ShieldCheck,
  Star,
  UserRound,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/cn';
import type { NavigationItem } from '@/types/navigation';

export const applicationNavigation: readonly NavigationItem[] = [
  { label: 'Tableau', to: '/espace', icon: LayoutDashboard, end: true },
  { label: 'Découvrir', to: '/espace/decouvrir', icon: Compass },
  { label: 'Missions', to: '/espace/missions', icon: PanelsTopLeft },
  { label: 'Candidatures', to: '/espace/candidatures', icon: FileUser },
  { label: 'Suivi', to: '/espace/matches', icon: ListChecks },
  { label: 'Messages', to: '/espace/messages', icon: MessageCircle },
  { label: 'Alertes', to: '/espace/notifications', icon: Bell },
  { label: 'Avis', to: '/espace/avis', icon: Star },
  { label: 'Favoris', to: '/espace/favoris', icon: Heart },
  { label: 'Profil', to: '/espace/profil', icon: UserRound },
  { label: 'Sécurité', to: '/espace/securite', icon: ShieldCheck },
] as const;

function NavigationLinks({ compact = false }: { compact?: boolean }) {
  const mobilePaths = new Set([
    '/espace',
    '/espace/decouvrir',
    '/espace/missions',
    '/espace/messages',
    '/espace/profil',
  ]);
  return applicationNavigation
    .filter((item) => !compact || mobilePaths.has(item.to))
    .map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          {...(compact ? { 'aria-label': item.label } : {})}
          className={({ isActive }) =>
            cn('app-nav-link', isActive && 'is-active')
          }
          {...(item.end !== undefined ? { end: item.end } : {})}
          key={item.to}
          to={item.to}
        >
          {Icon ? <Icon aria-hidden="true" size={20} /> : null}
          <span>{item.label}</span>
        </NavLink>
      );
    });
}

export function DesktopAppNavigation() {
  return (
    <aside className="app-sidebar">
      <NavLink className="brand" to="/" aria-label="SkillMatch, accueil public">
        <span aria-hidden="true">S</span>
        SkillMatch
      </NavLink>
      <nav aria-label="Navigation de l’espace applicatif">
        <NavigationLinks />
      </nav>
      <p className="app-preview-note">
        Les accès restent contrôlés par votre session et les politiques serveur.
      </p>
    </aside>
  );
}

export function MobileAppNavigation() {
  return (
    <nav
      className="app-bottom-navigation"
      aria-label="Navigation principale mobile"
    >
      <NavigationLinks compact />
    </nav>
  );
}
