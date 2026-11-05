import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages (/<repo>/), Netlify, or any static host.
// `vite build --mode artifact` inlines the fonts as data URIs for hosts with a strict font CSP.
export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: mode === 'artifact' ? (file) => (/\.woff2?$/.test(file) ? true : undefined) : 0,
    chunkSizeWarningLimit: 900,
  },
  server: { host: true },
}));
