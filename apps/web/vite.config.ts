import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Proxies `/api/*` to the locally-running API so the browser sees one
    // same-origin app in dev too, mirroring the same-origin nginx reverse
    // proxy used in the Docker Compose/production shape (see
    // infra/docker/web/nginx.conf and docs/architecture/authentication.md,
    // "Cookie policy"). This is what makes the session cookie's
    // `SameSite=Lax` sufficient without any cross-origin cookie exception.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  // `vite preview` serves the production build (what `playwright.config.ts`
  // targets) — it needs the same same-origin `/api` proxy as the dev
  // server above, or every API call in a built-preview e2e run 404s
  // against the static file server instead of reaching the API.
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
