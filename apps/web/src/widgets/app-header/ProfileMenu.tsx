import { useNavigate } from 'react-router-dom';
import { LogOut, Settings } from 'lucide-react';
import { useCurrentUser } from '../../features/auth/api/useCurrentUser';
import { useLogoutMutation } from '../../features/auth/api/useLogoutMutation';
import { ROLE_LABELS } from '../../shared/config/roles';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '../../shared/ui/Dropdown';
import { Skeleton } from '../../shared/ui/Skeleton';
import styles from './ProfileMenu.module.css';

/**
 * Only ever mounted inside the `RequireAuth`-gated shell (see
 * `app/router/routes.tsx`), so `user` is expected to be populated by
 * the time this renders — the `Skeleton` fallback below covers the
 * brief window between that guard confirming a session exists and this
 * component's own `useCurrentUser()` call resolving from the same
 * (already-warm) cache entry, not a real "logged out" state.
 */
export function ProfileMenu() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogoutMutation();

  if (!user) {
    return <Skeleton width={24} height={24} radius="full" />;
  }

  function handleSignOut() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate('/login', { replace: true }),
    });
  }

  return (
    <Dropdown>
      <DropdownTrigger className={styles.trigger} aria-label="Account menu">
        <Avatar name={user.displayName} size="sm" />
      </DropdownTrigger>
      <DropdownMenu align="end" className={styles.panel}>
        <div className={styles.identity}>
          <p className={styles.name}>{user.displayName}</p>
          <Badge variant="accent">{ROLE_LABELS[user.role]}</Badge>
        </div>
        <DropdownItem icon={<Settings aria-hidden="true" />} onClick={() => navigate('/settings')}>
          Settings
        </DropdownItem>
        <DropdownItem icon={<LogOut aria-hidden="true" />} onClick={handleSignOut}>
          Sign out
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
