// ============================================================================
// Vite Configuration — PulseOps UI
//
// PURPOSE: Build tool configuration for the PulseOps frontend application.
// Defines path aliases (@shared, @config, @modules, @core) so all imports
// use clean aliases instead of relative paths.
//
// ARCHITECTURE: Single entry point (src/main.jsx), outputs to dist/.
// Runs on port 3000 in dev, proxies /api to the backend on port 4000.
// ============================================================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@config': path.resolve(__dirname, 'src/shared/config'),
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@core': path.resolve(__dirname, 'src/core'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
