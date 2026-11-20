import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../shared/ui/Button';
import styles from './ErrorBoundary.module.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled error in component tree', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className={styles.container} role="alert">
          <AlertTriangle className={styles.icon} aria-hidden="true" />
          <h1 className={styles.title}>Something went wrong</h1>
          <p className={styles.message}>
            An unexpected error occurred while rendering this page. Try reloading — if the problem
            persists, please contact support.
          </p>
          <Button variant="primary" onClick={this.handleReload}>
            Reload page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
