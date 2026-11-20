import { useEffect, useState } from 'react';
import { RESOURCE_DIFFICULTIES, RESOURCE_TYPES } from '@academy-library/contracts';
import type { ResourceDifficulty, ResourceType } from '@academy-library/contracts';
import { ALL_RESOURCE_TAGS, COURSES } from '../../../shared/data/resources';
import { Button } from '../../../shared/ui/Button';
import { Checkbox } from '../../../shared/ui/Checkbox';
import { Select } from '../../../shared/ui/Select';
import type { LibraryFilters } from '../hooks/useLibraryQueryState';
import { RESOURCE_DIFFICULTY_META, RESOURCE_TYPE_META } from '../resourceTypeMeta';
import styles from './FilterPanel.module.css';

export interface FilterPanelProps {
  /** The currently *applied* filters (from the URL) — the panel's draft
   * state resets to this whenever it changes from elsewhere. */
  filters: LibraryFilters;
  onApply: (filters: LibraryFilters) => void;
  onClear: () => void;
}

function toggleTag(tags: string[], tag: string): string[] {
  return tags.includes(tag) ? tags.filter((existing) => existing !== tag) : [...tags, tag];
}

/**
 * Explicit Apply/Clear rather than applying on every change — picking a
 * type, then a difficulty, then three tags shouldn't re-query the list
 * three times before the person is done choosing.
 */
export function FilterPanel({ filters, onApply, onClear }: FilterPanelProps) {
  const [draftType, setDraftType] = useState(filters.type ?? '');
  const [draftDifficulty, setDraftDifficulty] = useState(filters.difficulty ?? '');
  const [draftCourseId, setDraftCourseId] = useState(filters.courseId ?? '');
  const [draftTags, setDraftTags] = useState<string[]>(filters.tags ?? []);

  useEffect(() => {
    setDraftType(filters.type ?? '');
    setDraftDifficulty(filters.difficulty ?? '');
    setDraftCourseId(filters.courseId ?? '');
    setDraftTags(filters.tags ?? []);
  }, [filters]);

  const handleApply = () => {
    onApply({
      type: (draftType || undefined) as ResourceType | undefined,
      difficulty: (draftDifficulty || undefined) as ResourceDifficulty | undefined,
      courseId: draftCourseId || undefined,
      tags: draftTags,
    });
  };

  const handleClear = () => {
    setDraftType('');
    setDraftDifficulty('');
    setDraftCourseId('');
    setDraftTags([]);
    onClear();
  };

  return (
    <div className={styles.panel}>
      <div className={styles.controls}>
        <Select
          label="Resource type"
          value={draftType}
          onChange={(event) => setDraftType(event.target.value)}
        >
          <option value="">All types</option>
          {RESOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {RESOURCE_TYPE_META[type].label}
            </option>
          ))}
        </Select>

        <Select
          label="Difficulty"
          value={draftDifficulty}
          onChange={(event) => setDraftDifficulty(event.target.value)}
        >
          <option value="">All difficulties</option>
          {RESOURCE_DIFFICULTIES.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {RESOURCE_DIFFICULTY_META[difficulty].label}
            </option>
          ))}
        </Select>

        <Select
          label="Course"
          value={draftCourseId}
          onChange={(event) => setDraftCourseId(event.target.value)}
        >
          <option value="">All courses</option>
          {COURSES.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </Select>
      </div>

      <fieldset className={styles.tagsFieldset}>
        <legend className={styles.tagsLegend}>Tags</legend>
        <div className={styles.tagsGrid}>
          {ALL_RESOURCE_TAGS.map((tag) => (
            <Checkbox
              key={tag}
              label={tag}
              checked={draftTags.includes(tag)}
              onChange={() => setDraftTags((current) => toggleTag(current, tag))}
            />
          ))}
        </div>
      </fieldset>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={handleClear}>
          Clear all
        </Button>
        <Button variant="primary" onClick={handleApply}>
          Apply filters
        </Button>
      </div>
    </div>
  );
}
