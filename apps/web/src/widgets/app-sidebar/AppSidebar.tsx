import { Link } from 'react-router-dom';
import { BookOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useCurrentUser } from '../../features/auth/api/useCurrentUser';
import { ROLE_LABELS } from '../../shared/config/roles';
import { Avatar } from '../../shared/ui/Avatar';
import { IconButton } from '../../shared/ui/IconButton';
import { Skeleton } from '../../shared/ui/Skeleton';
import { SidebarNav } from './SidebarNav';
import styles from './AppSidebar.module.css';

export interface AppSidebarProps {
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * The persistent desktop sidebar (≥1024px — see AppLayout.module.css for
 * the breakpoint). Always dark regardless of the app's light/dark theme:
 * `.sidebar` locally overrides the generic `--color-*` tokens to the same
 * literal values the dark theme uses, so every reused design-system
 * component (Avatar, IconButton, Tooltip, Select) renders correctly
 * without needing its own "on dark" variant.
 */
export function AppSidebar({ isCollapsed, onToggleCollapsed }: AppSidebarProps) {
  const { data: user } = useCurrentUser();

  return (
    <aside
      className={[styles.sidebar, isCollapsed ? styles.collapsed : null].filter(Boolean).join(' ')}
      aria-label="Sidebar"
    >
      <div className={styles.brandRow}>
        <Link to="/dashboard" className={styles.brand}>
          <BookOpen className={styles.brandIcon} aria-hidden="true" />
          {!isCollapsed && <span className={styles.brandWordmark}>Academy Library</span>}
        </Link>
      </div>

      <div className={styles.navScroll}>
        <SidebarNav isCollapsed={isCollapsed} />
      </div>

      <div className={styles.footer}>
        <div className={styles.footerRow}>
          <div className={styles.profile}>
            {user ? (
              <Avatar name={user.displayName} size="sm" />
            ) : (
              <Skeleton width={32} height={32} radius="full" />
            )}
            {!isCollapsed && user && (
              <div className={styles.profileText}>
                <p className={styles.profileName}>{user.displayName}</p>
                <p className={styles.profileRole}>{ROLE_LABELS[user.role]}</p>
              </div>
            )}
          </div>
          <IconButton
            icon={
              isCollapsed ? (
                <PanelLeftOpen aria-hidden="true" />
              ) : (
                <PanelLeftClose aria-hidden="true" />
              )
            }
            label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            variant="ghost"
            size="sm"
            onClick={onToggleCollapsed}
            className={styles.collapseButton}
          />
        </div>
      </div>
    </aside>
  );
}
