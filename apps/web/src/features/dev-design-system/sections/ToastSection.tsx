import { Button } from '../../../shared/ui/Button';
import { useToast } from '../../../shared/ui/Toast';
import { Section } from '../Section';
import styles from './ToastSection.module.css';

export function ToastSection() {
  const { showToast } = useToast();

  return (
    <Section
      id="toast"
      title="Toast"
      description="A shared queue announced through one polite live region, auto-dismissing after 5 seconds."
    >
      <div className={styles.row}>
        <Button
          variant="secondary"
          onClick={() =>
            showToast({
              variant: 'success',
              title: 'Resource saved',
              description: 'Your changes were published.',
            })
          }
        >
          Success
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            showToast({
              variant: 'error',
              title: 'Could not save',
              description: 'Check your connection and try again.',
            })
          }
        >
          Error
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            showToast({
              variant: 'warning',
              title: 'Unsaved changes',
              description: "You have edits that haven't been published.",
            })
          }
        >
          Warning
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            showToast({
              variant: 'info',
              title: 'New version available',
              description: 'Reload to pick up the latest changes.',
            })
          }
        >
          Info
        </Button>
      </div>
    </Section>
  );
}
