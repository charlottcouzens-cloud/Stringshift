import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
const basePath = process.env.PAGES_BASE_PATH ?? '/Stringshift';
export default defineConfig({
  root: fileURLToPath(new URL('./github-pages', import.meta.url)),
  base: `${basePath.replace(/\/$/, '')}/`,
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  build: { outDir: fileURLToPath(new URL('./dist-pages', import.meta.url)), emptyOutDir: true },
});
