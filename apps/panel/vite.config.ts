import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// VITE_HOSTED=1 builds the panel the site serves at /admin (ROADMAP 3.1).
const hosted = process.env.VITE_HOSTED === "1";

export default defineConfig({
  root: "web",
  base: hosted ? "/admin/" : "/",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../dist/web", emptyOutDir: true },
  server: {
    host: "127.0.0.1",
    port: 5174,
    proxy: { "/api": `http://127.0.0.1:${process.env.PORT ?? 5151}` },
  },
});
