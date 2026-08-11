import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // 显式监听 IPv4 loopback：Windows 上 host:false 会只绑 ::1，
    // 导致 Chromium/Edge 解析 localhost 为 127.0.0.1 时 ERR_CONNECTION_REFUSED
    host: host || '127.0.0.1',
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : { host: '127.0.0.1' },
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
}));
