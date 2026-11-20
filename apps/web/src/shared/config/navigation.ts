import {
  BookCopy,
  BookOpenCheck,
  Bookmark,
  FolderCog,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Library,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from './roles';

export interface NavItem {
  readonly label: string;
  readonly to: string;
  readonly icon: LucideIcon;
  /** Visible to every role when omitted. */
  readonly roles?: readonly UserRole[];
}

/** Every signed-in role sees these — none of them are role-specific. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Explore Library', to: '/library', icon: Library },
  { label: 'Collections', to: '/collections', icon: Layers },
  { label: 'Saved Resources', to: '/saved', icon: Bookmark },
  { label: 'Book Loans', to: '/loans', icon: BookCopy },
  { label: 'My Learning', to: '/learning', icon: GraduationCap },
];

export const SECONDARY_NAV: readonly NavItem[] = [
  { label: 'Settings', to: '/settings', icon: Settings },
];

/** Only ADMIN sees this section at all. */
export const ADMIN_NAV: readonly NavItem[] = [
  { label: 'Admin Dashboard', to: '/admin', icon: ShieldCheck, roles: ['ADMIN'] },
  { label: 'Manage Resources', to: '/admin/resources', icon: FolderCog, roles: ['ADMIN'] },
  { label: 'Manage Loans', to: '/admin/loans', icon: BookOpenCheck, roles: ['ADMIN'] },
  { label: 'Users', to: '/admin/users', icon: Users, roles: ['ADMIN'] },
];

/** `role: undefined` (the session hasn't resolved yet) is treated the
 * same as "not permitted" for any item that restricts by role — the
 * safe default while `useCurrentUser()` is still loading. */
export function isNavItemVisible(item: NavItem, role: UserRole | undefined): boolean {
  return !item.roles || (role !== undefined && item.roles.includes(role));
}

export function getVisibleNavItems(
  items: readonly NavItem[],
  role: UserRole | undefined,
): NavItem[] {
  return items.filter((item) => isNavItemVisible(item, role));
}
