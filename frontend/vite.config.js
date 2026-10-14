import { defineConfig } from 'vite';

// En desarrollo, el WebSocket/API van al servidor Node (npm start en ../server).
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/version': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
