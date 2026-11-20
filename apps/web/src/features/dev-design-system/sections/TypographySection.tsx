import { Section } from '../Section';
import styles from './TypographySection.module.css';

export function TypographySection() {
  return (
    <Section
      id="typography"
      title="Typography"
      description="Inter, with a type scale tuned for density and a clear hierarchy — tight tracking on large display sizes, generous body line-height."
    >
      <div className={styles.scale}>
        <p className={styles.display3xl}>Discover what to learn next</p>
        <p className={styles.display2xl}>Discover what to learn next</p>
        <p className={styles.displayXl}>Discover what to learn next</p>
        <p className={styles.headingLg}>Discover what to learn next</p>
        <p className={styles.bodyBase}>
          The quick brown fox jumps over the lazy dog — body text at the base size, meant for
          long-form reading.
        </p>
        <p className={styles.bodySm}>
          Secondary body text, used for supporting copy and metadata. The quick brown fox jumps over
          the lazy dog.
        </p>
        <p className={styles.caption}>CAPTION / LABEL TEXT</p>
      </div>
    </Section>
  );
}
