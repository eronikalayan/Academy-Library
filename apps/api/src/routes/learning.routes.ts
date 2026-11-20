import { Router } from 'express';
import { AppError } from '../errors/AppError.js';
import { requireAuth } from '../modules/auth/auth.middleware.js';
import { getLearningPage } from '../modules/learning/learning.service.js';

export const learningRouter = Router();

learningRouter.get('/learning', requireAuth(), async (req, res, next) => {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }
  const response = await getLearningPage(req.authUser);
  res.status(200).json(response);
});
