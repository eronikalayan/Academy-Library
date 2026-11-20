import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  RESOURCE_DIFFICULTIES,
  RESOURCE_TYPES,
  type ResourceCreateInput,
  type ResourceDetail,
  type ResourceUpdateInput,
} from '@academy-library/contracts';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/Card';
import { Checkbox } from '../../shared/ui/Checkbox';
import { Input } from '../../shared/ui/Input';
import { Radio } from '../../shared/ui/Radio';
import { Select } from '../../shared/ui/Select';
import { Skeleton } from '../../shared/ui/Skeleton';
import { Textarea } from '../../shared/ui/Textarea';
import { ALL_RESOURCE_TAGS } from '../../shared/data/resources';
import { useCoursesQuery } from './api/useCoursesQuery';
import { useGroupsQuery } from './api/useGroupsQuery';
import { TagInput } from './components/TagInput';
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog';
import { applyServerFieldErrors, getResourceMutationErrorMessage } from './resourceErrors';
import { useUnsavedChangesBlocker } from './useUnsavedChangesBlocker';
import {
  CREATE_DEFAULTS,
  DURATION_TYPES,
  ResourceFormValuesSchema,
  buildUpdateInput,
  toCreateInput,
  toFormValues,
  type ResourceFormValues,
} from './resourceFormSchema';
import { RESOURCE_DIFFICULTY_META, RESOURCE_TYPE_META } from './resourceTypeMeta';
import styles from './ResourceForm.module.css';

export type ResourceFormProps =
  | {
      mode: 'create';
      onSubmit: (input: ResourceCreateInput) => void;
      isSubmitting: boolean;
      submitError?: unknown;
    }
  | {
      mode: 'edit';
      initialResource: ResourceDetail;
      onSubmit: (input: ResourceUpdateInput) => void;
      isSubmitting: boolean;
      submitError?: unknown;
    };

/**
 * One form, two modes — `CreateResourcePage`/`EditResourcePage` each own
 * their own mutation hook and navigation/toast handling; this component
 * only knows about field state, validation, and producing the right
 * contract-shaped payload on submit (see `resourceFormSchema.ts`'s
 * `toCreateInput`/`buildUpdateInput`). Adapts which fields render based
 * on the selected `type` (duration only for VIDEO/RECORDING) and
 * `visibility` (the restricted-group picker only when RESTRICTED) — see
 * the task brief's "the form must adapt based on the selected resource
 * type."
 */
export function ResourceForm(props: ResourceFormProps) {
  const { mode, onSubmit, isSubmitting, submitError } = props;
  const defaultValues = mode === 'edit' ? toFormValues(props.initialResource) : CREATE_DEFAULTS;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<ResourceFormValues>({
    resolver: zodResolver(ResourceFormValuesSchema),
    defaultValues,
  });

  // The mutation itself (and its toast/navigation on success) is owned
  // by the calling page, not this form — but a server-side field
  // validation failure (a `VALIDATION_ERROR` the client's own
  // `zodResolver` pass didn't catch) still needs to land on *this*
  // form's fields, which only this component has a `setError` for.
  useEffect(() => {
    if (submitError !== undefined && submitError !== null) {
      applyServerFieldErrors(submitError, setError);
    }
  }, [submitError, setError]);

  const coursesQuery = useCoursesQuery();
  const groupsQuery = useGroupsQuery();

  const type = watch('type');
  const visibility = watch('visibility');
  const courseIds = watch('courseIds');
  const tags = watch('tags');
  const restrictedToGroupIds = watch('restrictedToGroupIds');
  const needsDuration = DURATION_TYPES.has(type);

  // Warn on an accidental tab close/refresh with unsaved changes — not a
  // complicated in-app autosave or navigation-blocking system, just the
  // browser's own native confirmation for the one accidental-data-loss
  // path that's cheap and reliable to guard against.
  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Covers the gap `beforeunload` can't: an in-app navigation (a sidebar
  // link, this page's own "Back to..." link, browser back/forward while
  // still inside the SPA) away from a dirty form. See the hook's own
  // doc comment for why a successful-submission navigate is exempt.
  const blocker = useUnsavedChangesBlocker(isDirty);

  const onValid = handleSubmit((values) => {
    if (mode === 'create') {
      onSubmit(toCreateInput(values));
    } else {
      onSubmit(buildUpdateInput(values, dirtyFields));
    }
  });

  function toggleCourse(courseId: string) {
    const next = courseIds.includes(courseId)
      ? courseIds.filter((id) => id !== courseId)
      : [...courseIds, courseId];
    setValue('courseIds', next, { shouldDirty: true, shouldValidate: true });
  }

  function toggleGroup(groupId: string) {
    const next = restrictedToGroupIds.includes(groupId)
      ? restrictedToGroupIds.filter((id) => id !== groupId)
      : [...restrictedToGroupIds, groupId];
    setValue('restrictedToGroupIds', next, { shouldDirty: true, shouldValidate: true });
  }

  const canSubmit = mode === 'create' || isDirty;
  const submitLabel = mode === 'create' ? 'Create resource' : 'Save changes';

  const suggestedTags = useMemo(
    () => ALL_RESOURCE_TAGS.filter((tag) => !tags.includes(tag)),
    [tags],
  );

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
          <CardDescription>What this resource is and how learners will find it.</CardDescription>
        </CardHeader>
        <CardContent className={styles.sectionGrid}>
          <Select label="Resource type" required error={errors.type?.message} {...register('type')}>
            {RESOURCE_TYPES.map((resourceType) => (
              <option key={resourceType} value={resourceType}>
                {RESOURCE_TYPE_META[resourceType].label}
              </option>
            ))}
          </Select>
          <Select
            label="Difficulty"
            required
            error={errors.difficulty?.message}
            {...register('difficulty')}
          >
            {RESOURCE_DIFFICULTIES.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {RESOURCE_DIFFICULTY_META[difficulty].label}
              </option>
            ))}
          </Select>
          <Input
            label="Title"
            required
            className={styles.spanFull}
            error={errors.title?.message}
            {...register('title')}
          />
          <Textarea
            label="Description"
            required
            rows={5}
            className={styles.spanFull}
            helperText="A short, learner-facing summary of what this resource covers."
            error={errors.description?.message}
            {...register('description')}
          />
          {needsDuration && (
            <Input
              label="Duration (minutes)"
              type="number"
              min={1}
              required
              helperText="Required for video and recording resources."
              error={errors.durationMinutes?.message}
              {...register('durationMinutes')}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Creator &amp; source</CardTitle>
          <CardDescription>Who made this, and where it originally comes from.</CardDescription>
        </CardHeader>
        <CardContent className={styles.sectionGrid}>
          <Input
            label="Creator name"
            required
            error={errors.creatorName?.message}
            {...register('creatorName')}
          />
          <Input
            label="Creator affiliation"
            helperText="Optional — e.g. a university or publisher."
            error={errors.creatorAffiliation?.message}
            {...register('creatorAffiliation')}
          />
          <Input
            label="Source URL"
            type="url"
            helperText="The original, licensed source — optional."
            error={errors.sourceUrl?.message}
            {...register('sourceUrl')}
          />
          <Input
            label="Cover image URL"
            type="url"
            helperText="Optional — shown on the resource card and detail page."
            error={errors.coverImageUrl?.message}
            {...register('coverImageUrl')}
          />
          <Input
            label="Publisher"
            helperText="Optional."
            error={errors.publisher?.message}
            {...register('publisher')}
          />
          <Input
            label="Published date"
            type="date"
            helperText="Optional — for published works like books or recorded talks."
            error={errors.publishedAt?.message}
            {...register('publishedAt')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Helps learners discover this resource while browsing.</CardDescription>
        </CardHeader>
        <CardContent className={styles.sectionStack}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Courses</legend>
            {coursesQuery.isPending ? (
              <Skeleton height="2.5rem" />
            ) : coursesQuery.isError ? (
              <Alert variant="warning">
                Couldn't load the course list. You can still save without one.
              </Alert>
            ) : coursesQuery.data.length === 0 ? (
              <p className={styles.emptyHint}>No courses exist yet.</p>
            ) : (
              <div className={styles.checkboxGrid}>
                {coursesQuery.data.map((course) => (
                  <Checkbox
                    key={course.id}
                    label={course.title}
                    checked={courseIds.includes(course.id)}
                    onChange={() => toggleCourse(course.id)}
                  />
                ))}
              </div>
            )}
          </fieldset>

          <TagInput
            label="Tags"
            helperText="Press Enter or comma to add. New tags are created automatically."
            tags={tags}
            onChange={(next) => setValue('tags', next, { shouldDirty: true, shouldValidate: true })}
            suggestions={suggestedTags}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visibility &amp; access</CardTitle>
          <CardDescription>Who is allowed to see this resource.</CardDescription>
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
                <Alert variant="danger">
                  Couldn't load the group list. Try again before saving.
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
