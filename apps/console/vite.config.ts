// The console's build: a page at /console that scripts/web.mjs (dev) and Vercel serve next to the
// Godot client. XOMDAO_SERVER_URL (as for the client) says where the API is; without it the page
// calls its own origin, which forwards /api in dev.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const server = process.env.XOMDAO_SERVER_URL || process.env.VITE_SERVER_URL || '';

export default defineConfig({
  base: '/console/',
  plugins: [react()],
  define: { __SERVER_URL__: JSON.stringify(server.replace(/\/$/, '')) },
  build: { outDir: 'dist', emptyOutDir: true },
});
