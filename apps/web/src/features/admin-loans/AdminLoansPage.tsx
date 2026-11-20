import { useState } from 'react';
import { BookCopy } from 'lucide-react';
import type { LoanStatus } from '@academy-library/contracts';
import { useAllLoansQuery } from '../loans/api/useAllLoansQuery';
import { useReturnLoanMutation } from '../loans/api/useReturnLoanMutation';
import { LoanRow } from '../loans/components/LoanRow';
import {
  getResourceListErrorMessage,
  getResourceMutationErrorMessage,
} from '../library/resourceErrors';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Pagination } from '../../shared/ui/Pagination';
import { Skeleton } from '../../shared/ui/Skeleton';
import { Tab, TabList, TabPanel, Tabs } from '../../shared/ui/Tabs';
import { useToast } from '../../shared/ui/Toast';
import { PageHeader } from '../../widgets/page-header';
import styles from './AdminLoansPage.module.css';

const PAGE_SIZE = 10;

function AllLoansTabPanel({ status }: { status: LoanStatus }) {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const { data, error, isPending, isError, refetch } = useAllLoansQuery({
    status,
    page,
    pageSize: PAGE_SIZE,
  });
  const returnMutation = useReturnLoanMutation();

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
      <Alert variant="danger" title="Couldn't load loans">
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
        title={status === 'ACTIVE' ? 'No active loans' : 'No returned loans yet'}
        description={
          status === 'ACTIVE'
            ? 'Loans borrowers check out will show up here, ready to process a return.'
            : 'Loans that have been returned will be listed here for reference.'
        }
      />
    );
  }

  return (
    <>
      <ul className={styles.list}>
        {data.items.map((loan) => (
          <li key={loan.id}>
            <LoanRow
              loan={loan}
              showBorrower
              action={
                status === 'ACTIVE' ? (
                  <Button
                    size="sm"
                    isLoading={returnMutation.isPending}
                    onClick={() => {
                      returnMutation.mutate(loan.id, {
                        onSuccess: () => {
                          showToast({
                            variant: 'success',
                            title: 'Loan marked returned',
                            description: `"${loan.copy.resource.title}" (${loan.copy.inventoryCode}) is available again.`,
                          });
                        },
                        onError: (mutationError) => {
                          showToast({
                            variant: 'error',
                            title: "Couldn't mark this loan returned",
                            description: getResourceMutationErrorMessage(mutationError),
                          });
                        },
                      });
                    }}
                  >
                    Mark returned
                  </Button>
                ) : undefined
              }
            />
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
 * `/admin/loans` — ADMIN-only (`RequireRole`, see `app/router/routes.tsx`,
 * same as `/admin/resources`/`/admin/users`). "Process checkouts and
 * returns" (the task brief's own phrase) is satisfied here for returns
 * — processing a *checkout* is the same self-service "Borrow" action
 * every authenticated role already has on a book's own page (see
 * `PhysicalCopiesSection`); this system has no concept of a patron
 * without their own account, so there is no separate staff-initiated
 * checkout form here.
 */
export function AdminLoansPage() {
  return (
    <div>
      <PageHeader
        title="Manage Loans"
        description="Review active and returned physical book loans, and process returns."
      />

      <Tabs defaultValue="active">
        <TabList>
          <Tab value="active">Active</Tab>
          <Tab value="returned">Returned</Tab>
        </TabList>
        <TabPanel value="active">
          <AllLoansTabPanel status="ACTIVE" />
        </TabPanel>
        <TabPanel value="returned">
          <AllLoansTabPanel status="RETURNED" />
        </TabPanel>
      </Tabs>
    </div>
  );
}
