import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// REAL site: https://songyisong88.github.io/lumi-app/app/  ·  DEMO site (VITE_SITE=demo): /lumi-app/demo/
const DEMO = process.env.VITE_SITE === 'demo'
const BASE = DEMO ? '/lumi-app/demo/' : '/lumi-app/app/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered in src/main.tsx (update checks + reload on new version)
      includeAssets: ['fonts/*.woff2', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: DEMO ? 'LUMI เว็บตัวอย่าง' : 'LUMI ตลาดงานครีเอเตอร์ AI',
        short_name: DEMO ? 'LUMI ตัวอย่าง' : 'LUMI',
        description: 'ตลาดภาพ เทมเพลต เครื่องมือ บอท คอร์ส และงานจ้างจากครีเอเตอร์',
        lang: 'th',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#6C2BD9',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // index.html is NOT precached: it is fetched network-first so a new deploy shows on the next open.
        globPatterns: ['**/*.{js,css,woff2,png,svg}'],
        navigateFallback: null,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'lumi-html', networkTimeoutSeconds: 4, expiration: { maxEntries: 5 },
              // GitHub Pages sends max-age=600 on HTML and Workbox ignores fetchOptions for navigations,
              // so re-issue the request with cache: 'no-cache' (cheap ETag revalidation) to never get a stale index.html.
              plugins: [{ requestWillFetch: async ({ request }) => new Request(request.url, { cache: 'no-cache', credentials: 'same-origin', redirect: 'manual' }) }],
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith(BASE + 'img/'),
            handler: 'CacheFirst',
            options: { cacheName: 'lumi-img', expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
})
