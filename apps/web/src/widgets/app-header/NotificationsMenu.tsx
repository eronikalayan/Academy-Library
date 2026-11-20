import { Bell } from 'lucide-react';
import { Dropdown, DropdownMenu, DropdownTrigger } from '../../shared/ui/Dropdown';
import styles from './NotificationsMenu.module.css';

/**
 * Honest placeholder: no unread badge, no fabricated notifications — just
 * an affordance that says plainly there's nothing wired up yet.
 */
export function NotificationsMenu() {
  return (
    <Dropdown>
      <DropdownTrigger className={styles.trigger} aria-label="Notifications">
        <Bell aria-hidden="true" />
      </DropdownTrigger>
      <DropdownMenu align="end" className={styles.panel}>
        <p className={styles.heading}>Notifications</p>
        <p className={styles.empty}>Nothing here yet — notifications aren&apos;t wired up.</p>
      </DropdownMenu>
    </Dropdown>
  );
}
