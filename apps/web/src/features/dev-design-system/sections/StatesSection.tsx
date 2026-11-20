import { useState } from 'react';
import { SearchX } from 'lucide-react';
import { Alert } from '../../../shared/ui/Alert';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Spinner } from '../../../shared/ui/Spinner';
import { Section } from '../Section';
import styles from './StatesSection.module.css';

export function StatesSection() {
  const [showInfoAlert, setShowInfoAlert] = useState(true);

  return (
    <Section
      id="states"
      title="Loading & error states"
      description="Spinner, Alert, and EmptyState — the vocabulary for everything that isn't the happy path."
    >
      <div className={styles.block}>
        <p className={styles.blockLabel}>Spinner</p>
        <div className={styles.spinnerRow}>
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Alert</p>
        <div className={styles.alertStack}>
          {showInfoAlert && (
            <Alert variant="info" title="Heads up" onDismiss={() => setShowInfoAlert(false)}>
              This banner can be dismissed.
            </Alert>
          )}
          <Alert variant="success" title="All changes saved" />
          <Alert variant="warning" title="Your session expires in 5 minutes" />
          <Alert variant="danger" title="Failed to load resources">
            Check your connection and try again.
          </Alert>
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Empty state</p>
        <EmptyState
          icon={<SearchX aria-hidden="true" />}
          title="No resources found"
          description="Try adjusting your filters, or add the first resource yourself."
          action={<Button size="sm">Add a resource</Button>}
        />
      </div>
    </Section>
  );
}
