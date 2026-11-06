import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Point VITE_API_BASE_URL at the backend (e.g. http://localhost:8080) via
// a .env file; api/client.js falls back to '/api' (same-origin, for when
// this is served behind a reverse proxy that forwards /api to the backend).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
