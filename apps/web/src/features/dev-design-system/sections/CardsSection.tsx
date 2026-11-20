import { BookOpen, Clock, Users } from 'lucide-react';
import { Avatar } from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../shared/ui/Card';
import { Section } from '../Section';
import styles from './CardsSection.module.css';

export function CardsSection() {
  return (
    <Section
      id="cards"
      title="Cards"
      description="A single surface primitive, composed with Header/Content/Footer parts."
    >
      <div className={styles.grid}>
        <Card>
          <CardHeader>
            <CardTitle>Intro to Algorithms</CardTitle>
            <CardDescription>
              A foundations course covering sorting, graphs, and complexity.
            </CardDescription>
          </CardHeader>
          <CardContent className={styles.meta}>
            <span className={styles.metaItem}>
              <BookOpen aria-hidden="true" />
              Course
            </span>
            <span className={styles.metaItem}>
              <Clock aria-hidden="true" />
              6h 20m
            </span>
            <span className={styles.metaItem}>
              <Users aria-hidden="true" />
              1.2k enrolled
            </span>
          </CardContent>
          <CardFooter>
            <Button size="sm">Continue</Button>
            <Button size="sm" variant="ghost">
              Save for later
            </Button>
          </CardFooter>
        </Card>

        <Card interactive padding="sm">
          <div className={styles.statRow}>
            <Avatar name="Priya Shah" />
            <div>
              <p className={styles.statTitle}>Priya Shah</p>
              <p className={styles.statSubtitle}>Contributed 14 resources</p>
            </div>
            <Badge variant="success">Active</Badge>
          </div>
        </Card>
      </div>
    </Section>
  );
}
