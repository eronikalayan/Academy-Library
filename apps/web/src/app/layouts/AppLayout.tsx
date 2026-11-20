import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from '../../widgets/app-header';
import { AppSidebar } from '../../widgets/app-sidebar';
import { MobileNavDrawer } from '../../widgets/mobile-navigation';
import styles from './AppLayout.module.css';

/**
 * The authenticated product shell: persistent sidebar (≥1024px) or a
 * drawer (below that), a sticky header, and a single scrolling content
 * region. Sidebar collapse state and mobile-drawer open state both live
 * here, since both the header and the sidebar itself need to trigger
 * them.
 */
export function AppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { pathname } = useLocation();

  // Belt-and-braces: SidebarNav's onNavigate already closes the drawer on
  // link click, but this also covers browser back/forward and any other
  // route change while it happens to be open.
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>

      <AppSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((current) => !current)}
      />

      <div className={styles.column}>
        <AppHeader
          onToggleSidebarCollapsed={() => setIsSidebarCollapsed((current) => !current)}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />
        <main id="main-content" tabIndex={-1} className={styles.main}>
          <div className={styles.content}>
            <Outlet />
          </div>
        </main>
      </div>

      <MobileNavDrawer isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />
    </div>
  );
}
