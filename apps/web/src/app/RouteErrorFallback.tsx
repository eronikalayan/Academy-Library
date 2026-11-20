import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import styles from './ErrorBoundary.module.css';

export function RouteErrorFallback() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'An unexpected error occurred while loading this page.';

  return (
    <div className={styles.container} role="alert">
      <AlertTriangle className={styles.icon} aria-hidden="true" />
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.message}>{message}</p>
    </div>
  );
}
