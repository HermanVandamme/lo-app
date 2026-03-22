import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // loadEnv leest .env.production (of .env.development) zonder shell-pad-conversie
  const env  = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE ?? '/'

  return {
    base,
    server: {
      host: true,
      port: 5173,
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',       // toon update-prompt i.p.v. stille autoUpdate
        injectRegister: 'auto',

        // ── Precache: alle app-bestanden + assets ───────────────────────────
        includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'images/**/*', 'images/APP_thumbnail.png'],
        manifest: {
          name: 'LO MASTER 2026',
          short_name: 'LO App',
          description: 'Leskaarten en evaluatie voor Lichamelijke Opvoeding',
          theme_color: '#E67E22',
          background_color: '#E67E22',
          display: 'standalone',
          orientation: 'portrait',
          scope: base,
          start_url: base,
          icons: [
            {
              src: 'images/APP_thumbnail.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'images/APP_thumbnail.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },

        // ── Workbox ─────────────────────────────────────────────────────────
        workbox: {
          // Precache: JS, CSS, HTML, afbeeldingen, JSON-data
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,webp,json}'],

          cleanupOutdatedCaches: true,

          // SPA-routing offline: alle navigaties → index.html
          // GitHub Pages 404.html zorgt voor de eerste load van diepe URLs.
          navigateFallback: base + 'index.html',

          runtimeCaching: [
            // Sportafbeeldingen — Cache First (zelden gewijzigd)
            {
              urlPattern: /\/images\/.+\.(png|jpg|webp|svg)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 90,  // 90 dagen
                },
              },
            },

            // Google Fonts — Cache First
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-static',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },

            // Supabase API — Network First met offline-fallback
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-cache',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24,       // 1 dag
                },
              },
            },
          ],
        },

        devOptions: {
          enabled: false,   // SW alleen in productie-build
        },
      }),
    ],
  }
})
