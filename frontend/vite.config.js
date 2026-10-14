import { defineConfig } from 'vite';

// Rutas relativas: el build funciona servido por ../server o en cualquier hosting estático.
// En desarrollo, el WebSocket y la API van al servidor Node (npm start en ../server).
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/version': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
  },
});
