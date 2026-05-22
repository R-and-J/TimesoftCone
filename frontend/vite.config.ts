import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/api": {
        // 백엔드는 3002 (3001은 D:\core와 충돌하여 양보).
        // localhost 대신 127.0.0.1 — Node 17+가 localhost를 IPv6(::1)로 먼저
        // 풀어 ECONNREFUSED 나는 것을 방지 (백엔드는 IPv4 바인드).
        target: "http://127.0.0.1:3002",
        changeOrigin: true,
      },
    },
  },
});
