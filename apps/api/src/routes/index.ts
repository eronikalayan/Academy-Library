import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { bookmarksRouter } from './bookmarks.routes.js';
import { collectionsRouter } from './collections.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { healthRouter } from './health.routes.js';
import { inventoryRouter } from './inventory.routes.js';
import { learningRouter } from './learning.routes.js';
import { loansRouter } from './loans.routes.js';
import { metadataRouter } from './metadata.routes.js';
import { resourcesRouter } from './resources.routes.js';

export const apiV1Router = Router();

apiV1Router.use(healthRouter);
apiV1Router.use(authRouter);
apiV1Router.use(resourcesRouter);
apiV1Router.use(metadataRouter);
apiV1Router.use(collectionsRouter);
apiV1Router.use(bookmarksRouter);
apiV1Router.use(inventoryRouter);
apiV1Router.use(loansRouter);
apiV1Router.use(dashboardRouter);
apiV1Router.use(learningRouter);
