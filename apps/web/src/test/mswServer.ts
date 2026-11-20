import { setupServer } from 'msw/node';

/**
 * One MSW server for the whole suite — started/reset/stopped from
 * `setup.ts`, so every test file gets it for free. Starts with no
 * handlers; each test file registers its own via `server.use(...)`
 * (see `mswHandlers.ts` for the shared defaults most auth tests build
 * on) rather than one giant shared handler set every test has to reason
 * about.
 */
export const server = setupServer();
