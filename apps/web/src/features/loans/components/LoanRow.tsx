import type { ReactNode } from 'react';
import type { Loan } from '@academy-library/contracts';
import { Badge } from '../../../shared/ui/Badge';
import { Card } from '../../../shared/ui/Card';
import styles from './LoanRow.module.css';

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export interface LoanRowProps {
  loan: Loan;
  /** Only the admin "all loans" view needs to say whose loan this is —
   * a user's own `/loans` list never does, it's always them. */
  showBorrower?: boolean;
  action?: ReactNode;
}

export function LoanRow({ loan, showBorrower = false, action }: LoanRowProps) {
  return (
    <Card padding="sm" className={styles.row}>
      <div className={styles.info}>
        <div className={styles.titleRow}>
          <p className={styles.title}>{loan.copy.resource.title}</p>
          <Badge variant="neutral">{loan.copy.inventoryCode}</Badge>
          {loan.isOverdue && <Badge variant="danger">Overdue</Badge>}
          {loan.status === 'RETURNED' && <Badge variant="success">Returned</Badge>}
        </div>
        <div className={styles.meta}>
          {showBorrower && <span className={styles.borrower}>{loan.borrower.displayName}</span>}
          <span className={styles.dates}>
            Borrowed {formatDate(loan.borrowedAt)} · Due {formatDate(loan.dueAt)}
            {loan.returnedAt && ` · Returned ${formatDate(loan.returnedAt)}`}
          </span>
        </div>
      </div>
      {action && <div className={styles.actions}>{action}</div>}
    </Card>
  );
}
