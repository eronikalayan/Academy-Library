import { useNavigate } from 'react-router-dom';
import { GraduationCap, Sparkles } from 'lucide-react';
import { useLearningPageQuery } from './api/useLearningPageQuery';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Skeleton, SkeletonText } from '../../shared/ui/Skeleton';
import { PageHeader } from '../../widgets/page-header';
import { CollectionCard } from '../collections/components/CollectionCard';
import { ResourceCard } from '../library/components/ResourceCard';
import { ResourceGrid } from '../library/components/ResourceGrid';
import { getResourceListErrorMessage } from '../library/resourceErrors';
import styles from './LearningPage.module.css';

/**
 * `/learning` — this app has no `Enrollment`/progress model, so this
 * page never claims to show personalized course progress or completed-
 * lesson counts (the Task 02-era placeholder's "In progress"/"Completed"
 * tabs did, dishonestly — there was never any real data behind them).
 * Every section here is honest course/content exploration, built
 * entirely from data this app actually has — see `learning.service.ts`
 * for exactly what each section is derived from.
 */
export function LearningPage() {
  const navigate = useNavigate();
  const { data, error, isPending, isError, refetch } = useLearningPageQuery();

  if (isPending) {
    return (
      <div>
        <PageHeader
          title="My Learning"
          description="Explore resources by course, relevant collections, and simple recommendations based on what you've saved."
        />
        <Skeleton height="2rem" width="30%" />
        <div className={styles.loadingBody}>
          <SkeletonText lines={3} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <PageHeader
          title="My Learning"
          description="Explore resources by course, relevant collections, and simple recommendations based on what you've saved."
        />
        <Alert variant="danger" title="Couldn't load your learning page">
          {getResourceListErrorMessage(error)}
          <div className={styles.retryRow}>
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  const isEmpty =
    data.courseGroups.length === 0 &&
    data.relevantCollections.length === 0 &&
    data.recentMaterials.length === 0 &&
    data.recommendations.length === 0;

  return (
    <div>
      <PageHeader
        title="My Learning"
        description="Explore resources by course, relevant collections, and simple recommendations based on what you've saved."
      />

      {isEmpty ? (
        <EmptyState
          icon={<GraduationCap aria-hidden="true" />}
          title="Nothing to explore yet"
          description="Once resources, courses, or collections exist in the library, you'll see them organized here."
          action={<Button onClick={() => navigate('/library')}>Browse the library</Button>}
        />
      ) : (
        <>
          {data.recommendations.length > 0 && (
            <Card
              padding="lg"
              className={styles.recommendationsCard}
              role="region"
              aria-labelledby="learning-recommendations-heading"
            >
              <h2 id="learning-recommendations-heading" className={styles.recommendationsTitle}>
                <Sparkles aria-hidden="true" />
                Recommended for you
              </h2>
              <p className={styles.recommendationsSubtitle}>
                Based on resources you&apos;ve saved — each suggestion says exactly why.
              </p>
              <ul className={styles.recommendationGrid}>
                {data.recommendations.map((recommendation) => (
                  <li key={recommendation.resource.id}>
                    <ResourceCard resource={recommendation.resource} variant="grid" />
                    <p className={styles.reason}>{recommendation.reason}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data.courseGroups.length > 0 && (
            <section className={styles.section} aria-labelledby="learning-courses-heading">
              <h2 id="learning-courses-heading" className={styles.sectionTitle}>
                Explore by course
              </h2>
              <div className={styles.courseList}>
                {data.courseGroups.map((group) => (
                  <div key={group.course.id}>
                    <h3 className={styles.courseTitle}>{group.course.title}</h3>
                    <ResourceGrid resources={group.resources} view="grid" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.relevantCollections.length > 0 && (
            <section className={styles.section} aria-labelledby="learning-collections-heading">
              <h2 id="learning-collections-heading" className={styles.sectionTitle}>
                Collections you can explore
              </h2>
              <div className={styles.collectionGrid}>
                {data.relevantCollections.map((collection) => (
                  <CollectionCard key={collection.id} collection={collection} />
                ))}
              </div>
            </section>
          )}

          {data.recentMaterials.length > 0 && (
            <section className={styles.section} aria-labelledby="learning-recent-heading">
              <h2 id="learning-recent-heading" className={styles.sectionTitle}>
                Recently added
              </h2>
              <ResourceGrid resources={data.recentMaterials} view="grid" />
            </section>
          )}
        </>
      )}
    </div>
  );
}
