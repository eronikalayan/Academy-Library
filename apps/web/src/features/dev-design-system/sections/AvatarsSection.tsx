import { Avatar } from '../../../shared/ui/Avatar';
import { Section } from '../Section';
import styles from './AvatarsSection.module.css';

export function AvatarsSection() {
  return (
    <Section
      id="avatars"
      title="Avatars"
      description="Falls back to initials when there's no image, or when the image fails to load."
    >
      <div className={styles.row}>
        <Avatar name="Dana Kim" size="sm" />
        <Avatar name="Dana Kim" size="md" />
        <Avatar name="Dana Kim" size="lg" />
        <Avatar name="Dana Kim" size="xl" />
      </div>
      <div className={styles.row}>
        <Avatar name="Broken Image" src="https://example.invalid/missing.jpg" />
        <span className={styles.note}>
          ← image URL intentionally fails to load, falls back to initials
        </span>
      </div>
    </Section>
  );
}
