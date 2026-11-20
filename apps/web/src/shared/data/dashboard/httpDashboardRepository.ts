import { DashboardStatsSchema } from '@academy-library/contracts';
import type { DashboardStats } from '@academy-library/contracts';
import { apiRequest } from '../../api/httpClient';
import type { DashboardRepository } from './DashboardRepository';

export class HttpDashboardRepository implements DashboardRepository {
  async getStats(signal?: AbortSignal): Promise<DashboardStats> {
    return apiRequest('/dashboard', (data) => DashboardStatsSchema.parse(data), { signal });
  }
}
