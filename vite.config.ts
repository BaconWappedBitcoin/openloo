/// <reference types="node" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// BASE_PATH lets the same source build for a domain root (self-hosted, Docker)
// and for a GitHub Pages project subpath such as `/openloo/`.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
})
