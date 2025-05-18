import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import svgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        // SVGR options go here
        icon: true,
        dimensions: false,
        titleProp: true,
        exportType: 'named',
      },
      include: '**/*.svg',
    }),
  ],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome105', 'safari13'],
    minify: 'esbuild',
    sourcemap: true,
  },
})