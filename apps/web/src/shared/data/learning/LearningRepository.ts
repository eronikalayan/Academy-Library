import type { LearningPageResponse } from '@academy-library/contracts';

export interface LearningRepository {
  getLearningPage(signal?: AbortSignal): Promise<LearningPageResponse>;
}
