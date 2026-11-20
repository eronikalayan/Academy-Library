import { useCurrentUser } from '../auth/api/useCurrentUser';
import { ThemeToggle } from '../../app/theme/ThemeToggle';
import { ROLE_LABELS } from '../../shared/config/roles';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/Card';
import { Skeleton } from '../../shared/ui/Skeleton';
import { PageHeader } from '../../widgets/page-header';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const { data: user } = useCurrentUser();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your profile and how Academy Library looks."
      />

      <div className={styles.stack}>
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose how Academy Library looks on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account details, as the backend knows them.</CardDescription>
          </CardHeader>
          <CardContent className={styles.profile}>
            {user ? (
              <>
                <Avatar name={user.displayName} size="lg" />
                <div>
                  <p className={styles.name}>{user.displayName}</p>
                  <p className={styles.email}>{user.email}</p>
                  <Badge variant="accent" className={styles.role}>
                    {ROLE_LABELS[user.role]}
                  </Badge>
                </div>
              </>
            ) : (
              <Skeleton width={48} height={48} radius="full" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
