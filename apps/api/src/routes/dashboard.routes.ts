import { Router } from 'express';
import { AppError } from '../errors/AppError.js';
import { requireAuth } from '../modules/auth/auth.middleware.js';
import { getDashboardStats } from '../modules/dashboard/dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const stats = await getDashboardStats(req.authUser);
  res.status(200).json(stats);
});
