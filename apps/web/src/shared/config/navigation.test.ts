import { describe, expect, it } from 'vitest';
import { LayoutDashboard } from 'lucide-react';
import {
  ADMIN_NAV,
  PRIMARY_NAV,
  SECONDARY_NAV,
  getVisibleNavItems,
  isNavItemVisible,
} from './navigation';
import type { NavItem } from './navigation';

describe('isNavItemVisible', () => {
  it('is visible to every role when the item declares no roles', () => {
    const item: NavItem = { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard };

    expect(isNavItemVisible(item, 'STUDENT')).toBe(true);
    expect(isNavItemVisible(item, 'LECTURER')).toBe(true);
    expect(isNavItemVisible(item, 'ADMIN')).toBe(true);
  });

  it('is only visible to the roles it lists', () => {
    const item: NavItem = {
      label: 'Admin Dashboard',
      to: '/admin',
      icon: LayoutDashboard,
      roles: ['ADMIN'],
    };

    expect(isNavItemVisible(item, 'ADMIN')).toBe(true);
    expect(isNavItemVisible(item, 'STUDENT')).toBe(false);
    expect(isNavItemVisible(item, 'LECTURER')).toBe(false);
  });

  it('hides a role-gated item when the role is not resolved yet, but still shows an unrestricted one', () => {
    const everyone: NavItem = { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard };
    const adminOnly: NavItem = {
      label: 'Admin Dashboard',
      to: '/admin',
      icon: LayoutDashboard,
      roles: ['ADMIN'],
    };

    expect(isNavItemVisible(everyone, undefined)).toBe(true);
    expect(isNavItemVisible(adminOnly, undefined)).toBe(false);
  });
});

describe('getVisibleNavItems', () => {
  it('filters a list down to what a role can see', () => {
    const items: NavItem[] = [
      { label: 'Everyone', to: '/a', icon: LayoutDashboard },
      { label: 'Admins only', to: '/b', icon: LayoutDashboard, roles: ['ADMIN'] },
    ];

    expect(getVisibleNavItems(items, 'STUDENT').map((item) => item.label)).toEqual(['Everyone']);
    expect(getVisibleNavItems(items, 'ADMIN').map((item) => item.label)).toEqual([
      'Everyone',
      'Admins only',
    ]);
  });
});

describe('navigation config', () => {
  it('shows the same primary and secondary nav to every role', () => {
    for (const role of ['STUDENT', 'LECTURER', 'ADMIN'] as const) {
      expect(getVisibleNavItems(PRIMARY_NAV, role)).toHaveLength(PRIMARY_NAV.length);
      expect(getVisibleNavItems(SECONDARY_NAV, role)).toHaveLength(SECONDARY_NAV.length);
    }
  });

  it('only shows the admin section to ADMIN', () => {
    expect(getVisibleNavItems(ADMIN_NAV, 'STUDENT')).toHaveLength(0);
    expect(getVisibleNavItems(ADMIN_NAV, 'LECTURER')).toHaveLength(0);
    expect(getVisibleNavItems(ADMIN_NAV, 'ADMIN')).toHaveLength(ADMIN_NAV.length);
  });
});
