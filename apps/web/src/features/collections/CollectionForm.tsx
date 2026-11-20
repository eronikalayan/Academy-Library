import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type {
  CollectionCreateInput,
  CollectionDetail,
  CollectionUpdateInput,
} from '@academy-library/contracts';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/Card';
import { Checkbox } from '../../shared/ui/Checkbox';
import { Input } from '../../shared/ui/Input';
import { Radio } from '../../shared/ui/Radio';
import { Skeleton } from '../../shared/ui/Skeleton';
import { Textarea } from '../../shared/ui/Textarea';
import { useGroupsQuery } from '../library/api/useGroupsQuery';
import { UnsavedChangesDialog } from '../library/components/UnsavedChangesDialog';
import { applyServerFieldErrors, getResourceMutationErrorMessage } from '../library/resourceErrors';
import { useUnsavedChangesBlocker } from '../library/useUnsavedChangesBlocker';
import {
  CREATE_DEFAULTS,
  CollectionFormValuesSchema,
  buildUpdateInput,
  toCreateInput,
  toFormValues,
  type CollectionFormValues,
} from './collectionFormSchema';
import styles from './CollectionForm.module.css';

export type CollectionFormProps =
  | {
      mode: 'create';
      onSubmit: (input: CollectionCreateInput) => void;
      isSubmitting: boolean;
      submitError?: unknown;
    }
  | {
      mode: 'edit';
      initialCollection: CollectionDetail;
      onSubmit: (input: CollectionUpdateInput) => void;
      isSubmitting: boolean;
      submitError?: unknown;
    };

/**
 * One form, two modes — mirrors `ResourceForm`'s own architecture
 * exactly (see that component's doc comment and
 * docs/architecture/decisions.md): `CreateCollectionPage`/
 * `EditCollectionPage` each own their mutation hook and navigation/
 * toast handling; this component only knows about field state,
 * validation, and producing the right contract-shaped payload via
 * `collectionFormSchema.ts`.
 */
export function CollectionForm(props: CollectionFormProps) {
  const { mode, onSubmit, isSubmitting, submitError } = props;
  const defaultValues = mode === 'edit' ? toFormValues(props.initialCollection) : CREATE_DEFAULTS;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<CollectionFormValues>({
    resolver: zodResolver(CollectionFormValuesSchema),
    defaultValues,
  });

  useEffect(() => {
    if (submitError !== undefined && submitError !== null) {
      applyServerFieldErrors(submitError, setError);
    }
  }, [submitError, setError]);

  const groupsQuery = useGroupsQuery();
  const visibility = watch('visibility');
  const restrictedToGroupIds = watch('restrictedToGroupIds');

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const blocker = useUnsavedChangesBlocker(isDirty);

  const onValid = handleSubmit((values) => {
    if (mode === 'create') {
      onSubmit(toCreateInput(values));
    } else {
      onSubmit(buildUpdateInput(values, dirtyFields));
    }
  });

  function toggleGroup(groupId: string) {
    const next = restrictedToGroupIds.includes(groupId)
      ? restrictedToGroupIds.filter((id) => id !== groupId)
      : [...restrictedToGroupIds, groupId];
    setValue('restrictedToGroupIds', next, { shouldDirty: true, shouldValidate: true });
  }

  const canSubmit = mode === 'create' || isDirty;
  const submitLabel = mode === 'create' ? 'Create collection' : 'Save changes';

  return (
    <form noValidate onSubmit={(event) => void onValid(event)} className={styles.form}>
      {submitError !== undefined && submitError !== null && (
        <Alert variant="danger" role="alert" className={styles.alert}>
          {getResourceMutationErrorMessage(submitError)}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
          <CardDescription>What this collection is and who it's for.</CardDescription>
        </CardHeader>
        <CardContent className={styles.sectionStack}>
          <Input label="Title" required error={errors.title?.message} {...register('title')} />
          <Textarea
            label="Description"
            required
            rows={4}
            helperText="A short summary of what this collection covers and why it's organized this way."
            error={errors.description?.message}
            {...register('description')}
          />
          <Input
            label="Cover image URL"
            helperText="Optional — shown on the collection's card and detail page."
            error={errors.coverImageUrl?.message}
            {...register('coverImageUrl')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visibility &amp; access</CardTitle>
          <CardDescription>Who is allowed to see this collection.</CardDescription>
        </CardHeader>
        <CardContent className={styles.sectionStack}>
          <div className={styles.radioRow} role="radiogroup" aria-label="Visibility">
            <Radio
              label="Public — visible to everyone"
              value="PUBLIC"
              {...register('visibility')}
            />
            <Radio
              label="Restricted — only specific groups"
              value="RESTRICTED"
              {...register('visibility')}
            />
          </div>

          {visibility === 'RESTRICTED' && (
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Restricted to</legend>
              {groupsQuery.isPending ? (
                <Skeleton height="2.5rem" />
              ) : groupsQuery.isError ? (
                <Alert variant="warning">
                  Couldn't load the group list. You can still save once groups load correctly.
                </Alert>
              ) : groupsQuery.data.length === 0 ? (
                <p className={styles.emptyHint}>No groups exist yet.</p>
              ) : (
                <div className={styles.checkboxGrid}>
                  {groupsQuery.data.map((group) => (
                    <Checkbox
                      key={group.id}
                      label={group.name}
                      checked={restrictedToGroupIds.includes(group.id)}
                      onChange={() => toggleGroup(group.id)}
                    />
                  ))}
                </div>
              )}
              {errors.restrictedToGroupIds?.message && (
                <p className={styles.fieldError} role="alert">
                  {errors.restrictedToGroupIds.message}
                </p>
              )}
            </fieldset>
          )}
        </CardContent>
      </Card>

      <div className={styles.actions}>
        <Button type="submit" isLoading={isSubmitting} disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </div>

      <UnsavedChangesDialog
        isOpen={blocker.state === 'blocked'}
        onStay={() => {
          if (blocker.state === 'blocked') blocker.reset();
        }}
        onLeave={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </form>
  );
}
