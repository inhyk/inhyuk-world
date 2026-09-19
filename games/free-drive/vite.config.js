import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'./',build:{outDir:'../../public/play/free-drive',emptyOutDir:true,chunkSizeWarningLimit:2500}});
