import { Section } from '../Section';
import styles from './ColorsSection.module.css';

interface SwatchGroupProps {
  title: string;
  swatches: Array<{ label: string; variable: string }>;
}

function SwatchGroup({ title, swatches }: SwatchGroupProps) {
  return (
    <div className={styles.group}>
      <p className={styles.groupTitle}>{title}</p>
      <div className={styles.grid}>
        {swatches.map((swatch) => (
          <div key={swatch.variable} className={styles.swatch}>
            <div
              className={styles.preview}
              style={{ backgroundColor: `var(${swatch.variable})` }}
            />
            <span className={styles.label}>{swatch.label}</span>
            <code className={styles.variable}>{swatch.variable}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ColorsSection() {
  return (
    <Section
      id="colors"
      title="Colors"
      description="Semantic tokens only — components never reference the raw palette directly. Swatches reflect the active theme live."
    >
      <SwatchGroup
        title="Surfaces"
        swatches={[
          { label: 'Background', variable: '--color-bg' },
          { label: 'Background subtle', variable: '--color-bg-subtle' },
          { label: 'Surface', variable: '--color-surface' },
          { label: 'Border', variable: '--color-border' },
          { label: 'Border strong', variable: '--color-border-strong' },
        ]}
      />
      <SwatchGroup
        title="Text"
        swatches={[
          { label: 'Primary', variable: '--color-text-primary' },
          { label: 'Secondary', variable: '--color-text-secondary' },
          { label: 'Muted', variable: '--color-text-muted' },
        ]}
      />
      <SwatchGroup
        title="Accent"
        swatches={[
          { label: 'Accent', variable: '--color-accent' },
          { label: 'Accent fill', variable: '--color-accent-fill' },
          { label: 'Accent subtle', variable: '--color-accent-subtle' },
        ]}
      />
      <SwatchGroup
        title="Status"
        swatches={[
          { label: 'Success', variable: '--color-success' },
          { label: 'Warning', variable: '--color-warning' },
          { label: 'Danger', variable: '--color-danger' },
        ]}
      />
    </Section>
  );
}
