import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@hitster/engine": path.resolve(__dirname, "../../packages/engine/src"),
      "@hitster/proto": path.resolve(__dirname, "../../packages/proto/src"),
      "@hitster/ui-kit": path.resolve(__dirname, "../../packages/ui-kit/src"),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    target: "esnext",
    sourcemap: true,
  },
});
