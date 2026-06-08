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
    // 외부 PC(같은 LAN, 예: http://192.168.10.74:5173)에서도 접속 가능하게 0.0.0.0 바인드.
    // Windows Defender Firewall가 처음 5173을 막을 수 있으므로 첫 실행 시 "허용" 선택.
    host: true,
    // Vite 5.4+ host-header 화이트리스트 — LAN ip 등으로 들어와도 거부되지 않게.
    allowedHosts: true,
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
