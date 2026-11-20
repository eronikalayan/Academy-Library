import { HttpLearningRepository } from './httpLearningRepository';
import type { LearningRepository } from './LearningRepository';

export type { LearningRepository } from './LearningRepository';
export { HttpLearningRepository } from './httpLearningRepository';

export const learningRepository: LearningRepository = new HttpLearningRepository();
