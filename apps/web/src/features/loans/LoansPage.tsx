import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookCopy } from 'lucide-react';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Pagination } from '../../shared/ui/Pagination';
import { Skeleton } from '../../shared/ui/Skeleton';
import { Tab, TabList, TabPanel, Tabs } from '../../shared/ui/Tabs';
import { PageHeader } from '../../widgets/page-header';
import { getResourceListErrorMessage } from '../library/resourceErrors';
import { useMyLoansQuery } from './api/useMyLoansQuery';
import { LoanRow } from './components/LoanRow';
import styles from './LoansPage.module.css';

const PAGE_SIZE = 10;

function LoanTabPanel({ status }: { status: 'ACTIVE' | 'RETURNED' }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, error, isPending, isError, refetch } = useMyLoansQuery({
    status,
    page,
    pageSize: PAGE_SIZE,
  });

  if (isPending) {
    return (
      <div className={styles.list}>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} height="4rem" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="danger" title="Couldn't load your loans">
        {getResourceListErrorMessage(error)}
        <div className={styles.retryRow}>
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </Alert>
    );
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={<BookCopy aria-hidden="true" />}
        title={status === 'ACTIVE' ? 'No active loans' : 'No loan history yet'}
        description={
          status === 'ACTIVE'
            ? 'Books you check out will appear here, along with their due dates.'
            : 'Books you borrow and return will show up here afterward.'
        }
        action={<Button onClick={() => navigate('/library')}>Browse the library</Button>}
      />
    );
  }

  return (
    <>
      <ul className={styles.list}>
        {data.items.map((loan) => (
          <li key={loan.id}>
            <LoanRow loan={loan} />
          </li>
        ))}
      </ul>
      {data.totalPages > 1 && (
        <div className={styles.paginationRow}>
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </div>
      )}
    </>
  );
}

/**
 * `/loans` — a user's own active and historical physical-book loans
 * (Task 07). Returning a book is always staff-processed (see
 * `/admin/loans`, `AdminLoansPage`) — there is no self-return action
 * here, matching how a physical return in real life requires handing
 * the book back to library staff, not clicking a button at home.
 */
export function LoansPage() {
  return (
    <div>
      <PageHeader
        title="Book Loans"
        description="Track physical books you've checked out from the library and when they're due back."
      />

      <Tabs defaultValue="active">
        <TabList>
          <Tab value="active">Active</Tab>
          <Tab value="history">History</Tab>
        </TabList>
        <TabPanel value="active">
          <LoanTabPanel status="ACTIVE" />
        </TabPanel>
        <TabPanel value="history">
          <LoanTabPanel status="RETURNED" />
        </TabPanel>
      </Tabs>
    </div>
  );
}
