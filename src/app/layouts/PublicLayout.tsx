import type { MouseEvent } from 'react';
import { Outlet, ScrollRestoration } from 'react-router-dom';

import { PublicFooter } from '@/components/navigation/PublicFooter';
import { PublicHeader } from '@/components/navigation/PublicHeader';

function focusMainContent(event: MouseEvent<HTMLAnchorElement>) {
  const main = document.getElementById('contenu');
  if (!main) return;
  event.preventDefault();
  main.tabIndex = -1;
  main.focus();
}

export function PublicLayout() {
  return (
    <div className="bg-canvas text-ink min-h-dvh">
      <a className="skip-link" href="#contenu" onClick={focusMainContent}>
        Aller au contenu principal
      </a>
      <PublicHeader />
      <Outlet />
      <PublicFooter />
      <ScrollRestoration />
    </div>
  );
}
