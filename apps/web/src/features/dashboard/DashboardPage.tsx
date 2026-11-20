import { useNavigate } from 'react-router-dom';
import { BookCopy, Bookmark, Layers, Library, Sparkles } from 'lucide-react';
import { useCurrentUser } from '../auth/api/useCurrentUser';
import { useDashboardStatsQuery } from './api/useDashboardStatsQuery';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Skeleton } from '../../shared/ui/Skeleton';
import { StatCard } from '../../shared/ui/StatCard';
import { PageHeader } from '../../widgets/page-header';
import { ResourceGrid } from '../library/components/ResourceGrid';
import { getResourceListErrorMessage } from '../library/resourceErrors';
import styles from './DashboardPage.module.css';

/**
 * Every number here comes straight from `GET /dashboard` — this
 * specific viewer's own authorization-aware counts (see
 * `dashboard.service.ts`), never a fabricated or placeholder figure.
 * There is no "courses in progress" stat (the Task 02-era placeholder
 * had one) — this app has no enrollment/progress model at all, so a
 * figure like that could only ever be invented, which the task brief
 * explicitly rules out.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const { data, error, isPending, isError, refetch } = useDashboardStatsQuery();
  const canCreate = user?.role === 'LECTURER' || user?.role === 'ADMIN';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="An overview of your learning activity and saved resources."
      />

      {isPending ? (
        <div className={styles.stats}>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} height="6.5rem" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="danger" title="Couldn't load your dashboard">
          {getResourceListErrorMessage(error)}
          <div className={styles.retryRow}>
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : (
        <>
          <div className={styles.stats}>
            <StatCard
              icon={<Library aria-hidden="true" />}
              label="Accessible resources"
              value={String(data.totalAccessibleResources)}
            />
            <StatCard
              icon={<Bookmark aria-hidden="true" />}
              label="Saved resources"
              value={String(data.savedResourcesCount)}
            />
            <StatCard
              icon={<Layers aria-hidden="true" />}
              label="Collections"
              value={String(data.availableCollectionsCount)}
            />
            <StatCard
              icon={<BookCopy aria-hidden="true" />}
              label="Active loans"
              value={String(data.activeLoansCount)}
            />
          </div>

          <h2 className={styles.sectionTitle}>Quick actions</h2>
          <div className={styles.quickActions}>
            <Button onClick={() => navigate('/library')}>Explore the library</Button>
            <Button variant="outline" onClick={() => navigate('/saved')}>
              View saved resources
            </Button>
            <Button variant="outline" onClick={() => navigate('/loans')}>
              View book loans
            </Button>
            {canCreate && (
              <Button variant="outline" onClick={() => navigate('/library/new')}>
                Create a resource
              </Button>
            )}
          </div>

          <section className={styles.recent} aria-labelledby="dashboard-recent-heading">
            <h2 id="dashboard-recent-heading" className={styles.sectionTitle}>
              Recently added
            </h2>
            {data.recentResources.length === 0 ? (
              <EmptyState
                icon={<Sparkles aria-hidden="true" />}
                title="Your activity will show up here"
                description="Once you start saving resources, borrowing books, or following a course, you'll see a summary of it on this dashboard."
                action={<Button onClick={() => navigate('/library')}>Explore the library</Button>}
              />
            ) : (
              <ResourceGrid resources={data.recentResources} view="grid" />
            )}
          </section>
        </>
      )}
    </div>
  );
}
