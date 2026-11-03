import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'

// base './' keeps the client build portable (any static host, GitHub Pages subpath).
// cloudflare() runs worker/ in the Workers runtime during dev and builds it next to the client.
// VitePWA writes manifest.webmanifest and builds src/sw.ts with the precache list; the page
// registers it from src/update.tsx. No service worker in dev.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(),
    // client build only: otherwise it also writes a manifest into the Worker's output
    ...VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        // heic-to (3 MB) only loads when a player picks an iPhone photo; the network serves it then
        // the manifest's icons are added by the plugin
        globPatterns: ['index.html', 'assets/*.{js,css}', 'brand/logo.png', 'lots/*.webp'],
        globIgnores: ['assets/heic-to-*.js'],
      },
      manifest: {
        id: './',
        name: 'Barista Game',
        short_name: 'Barista',
        description: 'Brew better coffee, avoid common mistakes, refine your recipes.',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#9AA784',
        background_color: '#F1EDE0',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }).map((p): Plugin => ({ ...p, applyToEnvironment: (env) => env.name === 'client' })),
  ],
})
