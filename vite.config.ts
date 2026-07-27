/// <reference types="node" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// BASE_PATH lets the same source build for a domain root (self-hosted, Docker)
// and for a GitHub Pages project subpath such as `/openloo/`.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  server: {
    // Dev-only: forward the sync API to a locally running server so `npm run
    // dev` can exercise sync. Point elsewhere with OPENLOO_API. Has no effect
    // on the production build, which is served behind nginx.
    proxy: {
      '/api': {
        target: process.env.OPENLOO_API ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
})
