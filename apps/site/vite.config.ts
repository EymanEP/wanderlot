import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const api = `http://localhost:${process.env.PORT ?? 8787}`;

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../dist/web", emptyOutDir: true },
  server: {
    port: 5173,
    // Passkeys check the page's origin: run the API with
    // WANDERLOT_ORIGIN=http://localhost:5173 when signing in through Vite.
    proxy: { "/api": api },
  },
});
