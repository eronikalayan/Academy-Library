import { useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { Section } from '../Section';
import styles from './ButtonsSection.module.css';

const VARIANTS = ['primary', 'secondary', 'outline', 'ghost', 'destructive'] as const;

export function ButtonsSection() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Section
      id="buttons"
      title="Buttons"
      description="Five variants, three sizes, with icon and loading support."
    >
      <div className={styles.row}>
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant[0]?.toUpperCase()}
            {variant.slice(1)}
          </Button>
        ))}
      </div>

      <div className={styles.row}>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>

      <div className={styles.row}>
        <Button leadingIcon={<Plus aria-hidden="true" />}>New resource</Button>
        <Button variant="secondary" trailingIcon={<Download aria-hidden="true" />}>
          Export
        </Button>
        <Button
          isLoading={isLoading}
          onClick={() => {
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 1500);
          }}
        >
          {isLoading ? 'Saving…' : 'Click to load'}
        </Button>
        <Button disabled>Disabled</Button>
      </div>

      <div className={styles.row}>
        <Button fullWidth variant="secondary">
          Full width
        </Button>
      </div>
    </Section>
  );
}
