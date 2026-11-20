import { Info } from 'lucide-react';
import { IconButton } from '../../../shared/ui/IconButton';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { Section } from '../Section';
import styles from './TooltipSection.module.css';

export function TooltipSection() {
  return (
    <Section
      id="tooltip"
      title="Tooltip"
      description="Shows on hover and on keyboard focus alike, dismisses on Escape, and is associated via aria-describedby."
    >
      <div className={styles.row}>
        <Tooltip content="Appears above" placement="top">
          <IconButton icon={<Info aria-hidden="true" />} label="Top tooltip" variant="outline" />
        </Tooltip>
        <Tooltip content="Appears below" placement="bottom">
          <IconButton icon={<Info aria-hidden="true" />} label="Bottom tooltip" variant="outline" />
        </Tooltip>
        <Tooltip content="Appears to the left" placement="left">
          <IconButton icon={<Info aria-hidden="true" />} label="Left tooltip" variant="outline" />
        </Tooltip>
        <Tooltip content="Appears to the right" placement="right">
          <IconButton icon={<Info aria-hidden="true" />} label="Right tooltip" variant="outline" />
        </Tooltip>
      </div>
    </Section>
  );
}
