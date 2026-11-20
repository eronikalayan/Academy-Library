import { HttpDashboardRepository } from './httpDashboardRepository';
import type { DashboardRepository } from './DashboardRepository';

export type { DashboardRepository } from './DashboardRepository';
export { HttpDashboardRepository } from './httpDashboardRepository';

export const dashboardRepository: DashboardRepository = new HttpDashboardRepository();
