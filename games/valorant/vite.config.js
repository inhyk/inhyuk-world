import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "../../public/play/valorant",
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
  },
});
