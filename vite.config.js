import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      workbox: {
        // El patrón por defecto no incluye .wasm, así que sql-wasm.wasm (638 KB)
        // se rebajaba de la red en CADA arranque en frío, incluso con la PWA
        // instalada. Aquí se añade explícitamente.
        //
        // Las imágenes quedan FUERA a propósito: hay ~12 MB de PNG en assets, y
        // precargarlas obligaría a descargar todo eso al instalar la app. Se
        // cachean bajo demanda con la regla de runtimeCaching de más abajo.
        globPatterns: ['**/*.{js,css,html,ico,svg,wasm}'],
        cleanupOutdatedCaches: true,
        importScripts: ['https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'],
        runtimeCaching: [
          {
            // Imágenes propias (assets/niveles, /descanso, /suscripciones...).
            // Se guardan la primera vez que se usan, en vez de descargarse todas
            // al instalar. Same-origin, por eso el patrón mira el pathname.
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'local-images-cache',
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 60 * 24 * 60, // 60 días
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/storage\.googleapis\.com\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'glide-images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ]
      },
      manifest: {
        name: 'Veta & Vigor App',
        short_name: 'V&V App',
        description: 'Tu plataforma de entrenamiento definitivo',
        theme_color: '#0f0f11',
        background_color: '#0f0f11',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});
