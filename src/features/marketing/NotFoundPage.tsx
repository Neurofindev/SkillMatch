import { ArrowLeft, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Page introuvable');
  return (
    <main className="not-found page-shell" id="contenu">
      <SearchX aria-hidden="true" />
      <p className="eyebrow">Erreur 404</p>
      <h1>Cette page n’existe pas.</h1>
      <p>Le lien est peut-être incomplet ou la page a été déplacée.</p>
      <Link className="button button-primary" to="/">
        <ArrowLeft aria-hidden="true" size={18} /> Retour à l’accueil
      </Link>
    </main>
  );
}
