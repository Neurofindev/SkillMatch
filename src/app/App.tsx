import { AppErrorBoundary } from '@/app/errors/AppErrorBoundary';
import { AppProviders } from '@/app/providers/AppProviders';
import { AppRouter } from '@/app/router';

export function App() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </AppErrorBoundary>
  );
}
