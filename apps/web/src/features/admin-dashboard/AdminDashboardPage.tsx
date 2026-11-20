import { BarChart3, FileWarning, Library, Users2 } from 'lucide-react';
import { StatCard } from '../../shared/ui/StatCard';
import { PageHeader } from '../../widgets/page-header';
import styles from './AdminDashboardPage.module.css';

export function AdminDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="A high-level view of the catalogue and its users. Reporting will populate these once connected."
      />

      <div className={styles.stats}>
        <StatCard
          icon={<Library aria-hidden="true" />}
          label="Total resources"
          caption="No data yet"
        />
        <StatCard icon={<Users2 aria-hidden="true" />} label="Total users" caption="No data yet" />
        <StatCard
          icon={<FileWarning aria-hidden="true" />}
          label="Pending reviews"
          caption="No data yet"
        />
        <StatCard
          icon={<BarChart3 aria-hidden="true" />}
          label="Loans this month"
          caption="No data yet"
        />
      </div>
    </div>
  );
}
