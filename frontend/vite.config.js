import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendProxyTarget = process.env.VITE_PROXY_TARGET || "http://localhost:3002";
const backendWsTarget    = backendProxyTarget.replace(/^http/, 'ws');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: backendProxyTarget,
        changeOrigin: true,
      },
      // Proxy WebSocket vers le backend (chemin dédié /ws)
      "/ws": {
        target: backendWsTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
