import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const license = readFileSync(new URL("./LICENSE", import.meta.url), "utf8");

export default defineConfig({
    base: "./",
    plugins: [{
        name: "snowflow-license",
        generateBundle() {
            this.emitFile({ type: "asset", fileName: "LICENSE.txt", source: license });
        },
    }],
    server: { host: "127.0.0.1", port: 5173, strictPort: true },
    build: {
        target: "esnext",
        outDir: "../../public/play/snowflow",
        emptyOutDir: true,
        sourcemap: false,
        reportCompressedSize: false,
        // The GPU engine and the procedural shaders load once, before play.
        chunkSizeWarningLimit: 2000,
    },
});
