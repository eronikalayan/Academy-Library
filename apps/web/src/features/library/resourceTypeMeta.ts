import { BookOpen, FileText, ListChecks, Mic, Video, File } from 'lucide-react';
import type { ComponentType } from 'react';
import type { ResourceDifficulty, ResourceType } from '@academy-library/contracts';
import type { BadgeVariant } from '../../shared/ui/Badge';

export interface ResourceTypeMeta {
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}

export const RESOURCE_TYPE_META: Record<ResourceType, ResourceTypeMeta> = {
  BOOK: { label: 'Book', icon: BookOpen },
  ARTICLE: { label: 'Article', icon: FileText },
  VIDEO: { label: 'Video', icon: Video },
  EXERCISE: { label: 'Exercise', icon: ListChecks },
  RECORDING: { label: 'Recording', icon: Mic },
  OTHER: { label: 'Other', icon: File },
};

export const RESOURCE_DIFFICULTY_META: Record<
  ResourceDifficulty,
  { label: string; badgeVariant: BadgeVariant }
> = {
  BEGINNER: { label: 'Beginner', badgeVariant: 'success' },
  INTERMEDIATE: { label: 'Intermediate', badgeVariant: 'warning' },
  ADVANCED: { label: 'Advanced', badgeVariant: 'accent' },
};
