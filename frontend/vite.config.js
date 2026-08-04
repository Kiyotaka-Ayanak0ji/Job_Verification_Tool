import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "TrustHire",
        short_name: "TrustHire",
        description: "Verify any job before you apply.",
        theme_color: "#020617",
        background_color: "#020617",
        display: "standalone",
        start_url: "/",
        icons: [
          { 
            src: "/icon-192.png", 
            sizes: "192x192", 
            type: "image/png" 
          },
          { 
            src: "/icon-512.png", 
            sizes: "512x512", 
            type: "image/png" 
          },
        ],
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
});