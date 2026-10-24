import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Christian Worship Centre — Church management PWA. Crafted by ProfJero.
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Only precache Latin font subsets — keeps the first install light on mobile data.
        // Admin screens and the charts library are cached on first use instead,
        // so members' phones don't download staff-only code on install.
        globIgnores: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*', '**/screenshots/**', 'assets/admin-*', 'assets/charts-*', '**/*.map'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        id: '/',
        name: 'Christian Worship Centre',
        short_name: 'CWC',
        description: 'Christian Worship Centre — church life in your pocket: devotionals, events, giving, prayer and care.',
        lang: 'en-GH',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#1e3a8a',
        categories: ['lifestyle', 'social', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Today’s devotional', short_name: 'Devotional', url: '/devotionals/today', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Request prayer', short_name: 'Prayer', url: '/care/new?type=prayer', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Events', short_name: 'Events', url: '/events', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Give', short_name: 'Give', url: '/give', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  server: {
    // Test artefacts must not trigger reloads in pages under test.
    watch: { ignored: ['**/test-results/**', '**/playwright-report/**', '**/e2e/**', '**/dist/**'] },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler|react-router)\//.test(id)) return 'react';
          if (/node_modules\/(@firebase|firebase)\//.test(id)) return 'firebase';
          return undefined;
        },
        chunkFileNames(chunk) {
          const staffOnly = (m: string) => m.includes('/src/features/admin/') || m.includes('/src/layouts/AdminLayout') || m.includes('/src/components/command-palette');
          const admin = (!!chunk.facadeModuleId && staffOnly(chunk.facadeModuleId)) || (chunk.moduleIds.length > 0 && chunk.moduleIds.every(staffOnly));
          return admin ? 'assets/admin-[name]-[hash].js' : 'assets/[name]-[hash].js';
        },
      },
    },
  },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
});
