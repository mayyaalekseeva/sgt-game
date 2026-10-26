import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

// base './' keeps the client build portable (any static host, GitHub Pages subpath).
// cloudflare() runs worker/ in the Workers runtime during dev and builds it next to the client.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), cloudflare()],
})
