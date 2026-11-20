import { NavLink } from 'react-router-dom';
import type { ReactElement } from 'react';
import {
  ADMIN_NAV,
  PRIMARY_NAV,
  SECONDARY_NAV,
  getVisibleNavItems,
} from '../../shared/config/navigation';
import type { NavItem } from '../../shared/config/navigation';
import { useCurrentUser } from '../../features/auth/api/useCurrentUser';
import { Tooltip } from '../../shared/ui/Tooltip';
import styles from './SidebarNav.module.css';

export interface SidebarNavProps {
  /** Icon-only mode: labels become screen-reader-only text plus a tooltip. */
  isCollapsed?: boolean;
  /** Called after a link is activated — the mobile drawer uses this to close itself. */
  onNavigate?: () => void;
}

/**
 * The nav list itself, independent of its surrounding chrome — reused by
 * the desktop `AppSidebar` and the mobile drawer so both stay in sync
 * with the same navigation config without duplicating this rendering.
 *
 * Only ever mounted inside the `RequireAuth`-gated shell, so a `user`
 * is expected here; if the cache somehow hasn't resolved yet, every
 * role-gated item is simply hidden until it does (the safe default —
 * see `getVisibleNavItems`, which treats a missing role as "show
 * nothing restricted"), never a flash of admin-only links.
 */
export function SidebarNav({ isCollapsed = false, onNavigate }: SidebarNavProps) {
  const { data: user } = useCurrentUser();
  const role = user?.role;
  const primaryItems = getVisibleNavItems(PRIMARY_NAV, role);
  const adminItems = getVisibleNavItems(ADMIN_NAV, role);
  const secondaryItems = getVisibleNavItems(SECONDARY_NAV, role);

  return (
    <nav className={styles.nav} aria-label="Main">
      <ul className={styles.list}>
        {primaryItems.map((item) => (
          <SidebarNavItem
            key={item.to}
            item={item}
            isCollapsed={isCollapsed}
            onNavigate={onNavigate}
          />
        ))}
      </ul>

      {adminItems.length > 0 && (
        <div className={styles.section}>
          <span className={isCollapsed ? 'sr-only' : styles.sectionLabel}>Admin</span>
          <ul className={styles.list}>
            {adminItems.map((item) => (
              <SidebarNavItem
                key={item.to}
                item={item}
                isCollapsed={isCollapsed}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      )}

      <div className={styles.section}>
        <ul className={styles.list}>
          {secondaryItems.map((item) => (
            <SidebarNavItem
              key={item.to}
              item={item}
              isCollapsed={isCollapsed}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </div>
    </nav>
  );
}

interface SidebarNavItemProps {
  item: NavItem;
  isCollapsed: boolean;
  onNavigate?: () => void;
}

function SidebarNavItem({ item, isCollapsed, onNavigate }: SidebarNavItemProps) {
  const Icon = item.icon;

  const link: ReactElement = (
    <NavLink
      to={item.to}
      end
      onClick={onNavigate}
      className={({ isActive }) =>
        [styles.link, isActive ? styles.linkActive : null].filter(Boolean).join(' ')
      }
    >
      <Icon className={styles.icon} aria-hidden="true" />
      <span className={isCollapsed ? 'sr-only' : styles.label}>{item.label}</span>
    </NavLink>
  );

  if (isCollapsed) {
    return (
      <li>
        <Tooltip content={item.label} placement="right">
          {link}
        </Tooltip>
      </li>
    );
  }

  return <li>{link}</li>;
}
