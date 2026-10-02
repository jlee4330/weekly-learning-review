import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  webServer: {
    command: "VITE_MODE=demo VITE_UNLOCKED_WEEKS=all npm run dev -- --port 5176 --strictPort",
    url: "http://127.0.0.1:5176",
    reuseExistingServer: false,
  },
  use: { baseURL: "http://127.0.0.1:5176", headless: true, channel: "chrome" },
  reporter: "list",
});
