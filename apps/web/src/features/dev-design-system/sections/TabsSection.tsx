import { Tab, TabList, TabPanel, Tabs } from '../../../shared/ui/Tabs';
import { Section } from '../Section';
import styles from './TabsSection.module.css';

export function TabsSection() {
  return (
    <Section
      id="tabs"
      title="Tabs"
      description="Arrow-key navigation between tabs, with a roving tab index."
    >
      <Tabs defaultValue="overview">
        <TabList>
          <Tab value="overview">Overview</Tab>
          <Tab value="curriculum">Curriculum</Tab>
          <Tab value="reviews">Reviews</Tab>
          <Tab value="disabled" disabled>
            Archived
          </Tab>
        </TabList>
        <TabPanel value="overview">
          <p className={styles.panelText}>
            A general introduction to the course, its goals, and who it's for.
          </p>
        </TabPanel>
        <TabPanel value="curriculum">
          <p className={styles.panelText}>
            Eight modules, each with a short assessment at the end.
          </p>
        </TabPanel>
        <TabPanel value="reviews">
          <p className={styles.panelText}>4.8 average rating across 312 reviews.</p>
        </TabPanel>
      </Tabs>
    </Section>
  );
}
