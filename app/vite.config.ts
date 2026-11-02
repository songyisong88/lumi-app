import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Deployed at https://songyisong88.github.io/lumi-app/app/
const BASE = '/lumi-app/app/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.woff2', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'LUMI ตลาดงานครีเอเตอร์ AI',
        short_name: 'LUMI',
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
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        runtimeCaching: [
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
