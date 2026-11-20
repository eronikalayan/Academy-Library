import { Link, useMatches } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { RouteHandle } from '../../app/router/types';
import styles from './Breadcrumb.module.css';

interface BreadcrumbEntry {
  title: string;
  pathname: string;
}

function useBreadcrumbTrail(): BreadcrumbEntry[] {
  const matches = useMatches();

  return matches.reduce<BreadcrumbEntry[]>((trail, match) => {
    const title = (match.handle as RouteHandle | undefined)?.title;
    if (title) trail.push({ title, pathname: match.pathname });
    return trail;
  }, []);
}

/** Reads `handle.title` off the matched route chain (see routes.tsx) — the
 * page title and the breadcrumb trail come from one source, not two. */
export function Breadcrumb() {
  const trail = useBreadcrumbTrail();

  if (trail.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
      <ol className={styles.list}>
        {trail.map((entry, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={entry.pathname} className={styles.item}>
              {isLast ? (
                <span className={styles.current} aria-current="page">
                  {entry.title}
                </span>
              ) : (
                <Link to={entry.pathname} className={styles.ancestor}>
                  {entry.title}
                </Link>
              )}
              {!isLast && <ChevronRight className={styles.separator} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
