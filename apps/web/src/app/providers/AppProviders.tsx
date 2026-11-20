import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '../ErrorBoundary';
import { queryClient } from '../queryClient';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ToastProvider } from '../../shared/ui/Toast';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Every app-wide context in one place, so main.tsx stays a plain
 * bootstrap. There is no auth provider here — authentication state is
 * not a separate context at all, it lives entirely in TanStack Query's
 * cache under the `['auth', 'me']` key (`features/auth/api/useCurrentUser.ts`),
 * which `QueryClientProvider` below already makes available everywhere.
 * See docs/architecture/authentication.md ("Frontend session state")
 * for why a second, duplicate store was deliberately not introduced.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
