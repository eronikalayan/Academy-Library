import { useState } from 'react';
import { Menu, PanelLeft, Search } from 'lucide-react';
import { ThemeToggle } from '../../app/theme/ThemeToggle';
import { IconButton } from '../../shared/ui/IconButton';
import { Breadcrumb } from './Breadcrumb';
import { NotificationsMenu } from './NotificationsMenu';
import { ProfileMenu } from './ProfileMenu';
import { SearchDialog } from './SearchDialog';
import styles from './AppHeader.module.css';

export interface AppHeaderProps {
  onToggleSidebarCollapsed: () => void;
  onOpenMobileNav: () => void;
}

export function AppHeader({ onToggleSidebarCollapsed, onOpenMobileNav }: AppHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <IconButton
          icon={<Menu aria-hidden="true" />}
          label="Open navigation"
          variant="ghost"
          className={styles.mobileTrigger}
          onClick={onOpenMobileNav}
        />
        <IconButton
          icon={<PanelLeft aria-hidden="true" />}
          label="Toggle sidebar"
          variant="ghost"
          className={styles.desktopTrigger}
          onClick={onToggleSidebarCollapsed}
        />
        <Breadcrumb />
      </div>

      <div className={styles.right}>
        <IconButton
          icon={<Search aria-hidden="true" />}
          label="Search"
          variant="ghost"
          onClick={() => setIsSearchOpen(true)}
        />
        <NotificationsMenu />
        <ThemeToggle />
        <ProfileMenu />
      </div>

      <SearchDialog isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
}
