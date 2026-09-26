import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The design-system gallery: npm run dev -w @wanderlot/ui
export default defineConfig({
  root: "gallery",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../dist/gallery", emptyOutDir: true },
  server: { port: 5175 },
});
