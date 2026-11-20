import { useState } from 'react';
import { BookCopy as BookCopyIcon } from 'lucide-react';
import { useCurrentUser } from '../../auth/api/useCurrentUser';
import { useBorrowResourceMutation } from '../../loans/api/useBorrowResourceMutation';
import { useArchiveCopyMutation } from '../api/useArchiveCopyMutation';
import { useBookCopiesQuery } from '../api/useBookCopiesQuery';
import { useRegisterCopyMutation } from '../api/useRegisterCopyMutation';
import { BOOK_COPY_STATUS_META } from '../bookCopyStatusMeta';
import { getResourceMutationErrorMessage } from '../resourceErrors';
import { Alert } from '../../../shared/ui/Alert';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { useToast } from '../../../shared/ui/Toast';
import styles from './PhysicalCopiesSection.module.css';

export interface PhysicalCopiesSectionProps {
  resourceId: string;
}

/**
 * Only ever rendered for a `BOOK` resource (see `ResourceDetailsPage`),
 * for any authenticated viewer — "students can view availability" and
 * "lecturers and admins can view physical inventory" are the same read
 * rule in this app (see `physicalLibrary.service.ts`). Borrowing is
 * self-service for every role: there is no separate "checkout on behalf
 * of another user" flow (see `LoanCreateInputSchema`'s doc comment in
 * packages/contracts). "Borrow" IS this system's reservation — there is
 * no hold/waitlist queue for a copy that's currently on loan, so the
 * button is simply disabled, with an honest note, once every copy is
 * checked out, rather than offering a queue this app doesn't have.
 */
export function PhysicalCopiesSection({ resourceId }: PhysicalCopiesSectionProps) {
  const { data: user } = useCurrentUser();
  const { showToast } = useToast();
  const { data, isPending, isError, refetch } = useBookCopiesQuery(resourceId);
  const borrowMutation = useBorrowResourceMutation();
  const registerMutation = useRegisterCopyMutation();
  const archiveMutation = useArchiveCopyMutation();
  const [inventoryCode, setInventoryCode] = useState('');

  const canManage = user?.role === 'ADMIN';
  const availableCount = data?.items.filter((copy) => copy.status === 'AVAILABLE').length ?? 0;
  const hasCopies = (data?.items.length ?? 0) > 0;

  function handleBorrow() {
    borrowMutation.mutate(resourceId, {
      onSuccess: () => {
        showToast({
          variant: 'success',
          title: 'Copy borrowed',
          description: 'See Book Loans for the due date.',
        });
      },
      onError: (mutationError) => {
        showToast({
          variant: 'error',
          title: "Couldn't borrow a copy",
          description: getResourceMutationErrorMessage(mutationError),
        });
      },
    });
  }

  function handleRegister() {
    const trimmed = inventoryCode.trim();
    if (!trimmed) return;
    registerMutation.mutate(
      { resourceId, inventoryCode: trimmed },
      {
        onSuccess: () => {
          setInventoryCode('');
          showToast({ variant: 'success', title: 'Copy registered', description: trimmed });
        },
        onError: (mutationError) => {
          showToast({
            variant: 'error',
            title: "Couldn't register copy",
            description: getResourceMutationErrorMessage(mutationError),
          });
        },
      },
    );
  }

  function handleArchive(copyId: string) {
    archiveMutation.mutate(
      { resourceId, copyId },
      {
        onError: (mutationError) => {
          showToast({
            variant: 'error',
            title: "Couldn't archive copy",
            description: getResourceMutationErrorMessage(mutationError),
          });
        },
      },
    );
  }

  return (
    <section className={styles.section} aria-labelledby="physical-copies-heading">
      <div className={styles.header}>
        <h2 id="physical-copies-heading" className={styles.sectionTitle}>
          Physical Copies
        </h2>
        <Button
          size="sm"
          leadingIcon={<BookCopyIcon aria-hidden="true" size={14} />}
          disabled={availableCount === 0}
          isLoading={borrowMutation.isPending}
          onClick={handleBorrow}
        >
          Borrow a copy
        </Button>
      </div>

      {isPending ? (
        <Skeleton height="3rem" />
      ) : isError ? (
        <Alert variant="danger" title="Couldn't load physical copies">
          <div className={styles.retryRow}>
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : !hasCopies ? (
        <p className={styles.hint}>No physical copies have been registered for this book yet.</p>
      ) : (
        <>
          <ul className={styles.copyList}>
            {data.items.map((copy) => {
              const meta = BOOK_COPY_STATUS_META[copy.status];
              return (
                <li key={copy.id} className={styles.copyRow}>
                  <span className={styles.copyCode}>{copy.inventoryCode}</span>
                  <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
                  {canManage && copy.status !== 'ARCHIVED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={copy.status === 'ON_LOAN'}
                      isLoading={archiveMutation.isPending}
                      onClick={() => handleArchive(copy.id)}
                      className={styles.archiveButton}
                    >
                      Archive
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {availableCount === 0 && (
            <p className={styles.hint}>
              All copies are currently checked out. There&apos;s no waitlist yet — check back later.
            </p>
          )}
        </>
      )}

      {canManage && (
        <div className={styles.registerForm}>
          <Input
            aria-label="New inventory code"
            placeholder="e.g. INV-042"
            value={inventoryCode}
            onChange={(event) => setInventoryCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleRegister();
            }}
          />
          <Button
            variant="outline"
            disabled={!inventoryCode.trim()}
            isLoading={registerMutation.isPending}
            onClick={handleRegister}
          >
            Register copy
          </Button>
        </div>
      )}
    </section>
  );
}
