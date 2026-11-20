import { LearningPageResponseSchema } from '@academy-library/contracts';
import type { LearningPageResponse } from '@academy-library/contracts';
import { apiRequest } from '../../api/httpClient';
import type { LearningRepository } from './LearningRepository';

export class HttpLearningRepository implements LearningRepository {
  async getLearningPage(signal?: AbortSignal): Promise<LearningPageResponse> {
    return apiRequest('/learning', (data) => LearningPageResponseSchema.parse(data), { signal });
  }
}
