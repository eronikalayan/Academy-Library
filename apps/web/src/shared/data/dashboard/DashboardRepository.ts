import type { DashboardStats } from '@academy-library/contracts';

export interface DashboardRepository {
  getStats(signal?: AbortSignal): Promise<DashboardStats>;
}
