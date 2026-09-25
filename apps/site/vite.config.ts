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
    proxy: {
      "/api": api,
      // Private links (?k=…) go to the API to set the cookie; plain /p/… is the SPA.
      "/p": {
        target: api,
        bypass: (req) => (new URL(req.url ?? "/", "http://x").searchParams.has("k") ? undefined : "/index.html"),
      },
    },
  },
});
