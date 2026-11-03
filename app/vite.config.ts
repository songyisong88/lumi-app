import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// REAL site: https://songyisong88.github.io/lumi-app/app/  ·  DEMO site (VITE_SITE=demo): /lumi-app/demo/
// Cloudflare Pages (each site on its own domain at the root): build with VITE_BASE=/ (see scripts/deploy-cloudflare.sh).
const DEMO = process.env.VITE_SITE === 'demo'
const BASE = process.env.VITE_BASE || (DEMO ? '/lumi-app/demo/' : '/lumi-app/app/')
// Brand: the DEMO site is rebranded to Pixeeno (owner, 2026-11-03; logo 03-mosaic in public/brand/). The REAL site stays LUMI.
const DEMO_DESC = 'Pixeeno ตลาดและคอมมูนิตี้งานสร้างสรรค์ AI ของคนไทย ซื้อขายภาพ เทมเพลต โปรแกรม บอท และคอร์ส'
const demoHtml = {
  name: 'pixeeno-demo-html',
  transformIndexHtml: { order: 'pre' as const, handler: (html: string) => !DEMO ? html : html
    .replace(/<title>[^<]*<\/title>/, '<title>Pixeeno ตลาดและคอมมูนิตี้งานสร้างสรรค์ AI</title>')
    .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${DEMO_DESC}"`)
    .replace('<link rel="icon" type="image/png" href="/icon-192.png" />', '<link rel="icon" type="image/svg+xml" href="/brand/icon.svg" />\n    <link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png" />')
    .replace('<link rel="apple-touch-icon" href="/icon-192.png" />', '<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" />') },
}

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    demoHtml,
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered in src/main.tsx (update checks + reload on new version)
      includeAssets: DEMO ? ['fonts/*.woff2', 'brand/*'] : ['fonts/*.woff2', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: DEMO ? 'Pixeeno เว็บตัวอย่าง' : 'LUMI ตลาดงานครีเอเตอร์ AI',
        short_name: DEMO ? 'Pixeeno' : 'LUMI',
        description: DEMO ? DEMO_DESC : 'ตลาดภาพ เทมเพลต เครื่องมือ บอท คอร์ส และงานจ้างจากครีเอเตอร์',
        lang: 'th',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#6C2BD9',
        icons: DEMO ? [
          { src: 'brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'brand/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ] : [
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
