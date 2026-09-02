import { Component, type ReactNode } from 'react';

import { ErrorState } from '@/components/ui/FeedbackStates';
import { getUserErrorMessage } from '@/lib/errors';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch() {
    // Un service de journalisation respectueux des données sera branché plus tard.
  }

  render() {
    if (this.state.error) {
      return (
        <main className="error-boundary" id="contenu">
          <ErrorState
            action={{
              label: 'Recharger la page',
              onClick: () => window.location.reload(),
            }}
            description={getUserErrorMessage(this.state.error)}
            title="SkillMatch ne peut pas afficher cette page"
          />
        </main>
      );
    }
    return this.props.children;
  }
}
