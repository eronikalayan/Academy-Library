import { CheckCircle2 } from 'lucide-react';
import { Badge } from '../../../shared/ui/Badge';
import { Section } from '../Section';
import styles from './BadgesSection.module.css';

const VARIANTS = ['neutral', 'accent', 'success', 'warning', 'danger'] as const;

export function BadgesSection() {
  return (
    <Section
      id="badges"
      title="Badges"
      description="Soft, tinted badges rather than loud solid fills — easier to pair with any surface."
    >
      <div className={styles.row}>
        {VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant[0]?.toUpperCase()}
            {variant.slice(1)}
          </Badge>
        ))}
        <Badge variant="success" icon={<CheckCircle2 aria-hidden="true" />}>
          Verified
        </Badge>
      </div>
    </Section>
  );
}
