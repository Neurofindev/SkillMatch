import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import { ErrorState } from '@/components/ui/FeedbackStates';
import { getUserErrorMessage } from '@/lib/errors';

export function RouteErrorPage() {
  const error = useRouteError();
  const description = isRouteErrorResponse(error)
    ? error.status === 404
      ? 'La page demandée est introuvable.'
      : `La page a répondu avec l’erreur ${error.status}.`
    : getUserErrorMessage(error);

  return (
    <main className="page-shell state-page" id="contenu">
      <ErrorState
        action={{
          label: 'Retour à l’accueil',
          onClick: () => (location.href = '/'),
        }}
        description={description}
        title="Impossible d’afficher cette page"
      />
    </main>
  );
}
