export type { ActorContext } from '../resources/resource.types.js';

export interface ListLoansParams {
  status?: 'ACTIVE' | 'RETURNED';
  page: number;
  pageSize: number;
}
