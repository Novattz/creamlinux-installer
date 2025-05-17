import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Removed unused import: loadEnv

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri supports es2021
    target: ['es2021', 'chrome105', 'safari13'],
    // Don't minify for debug builds
    minify: 'esbuild',
    // Produce sourcemaps for debug builds
    sourcemap: true,
  },
});