import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.REVIEW_API_PORT || 3001}`,
        // Preserve the browser's Host so the API can verify its Origin.
        changeOrigin: false,
      },
    },
  },
});
