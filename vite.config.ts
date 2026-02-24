import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export const CROSS_ORIGIN_ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp'
} as const

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: CROSS_ORIGIN_ISOLATION_HEADERS
  },
  preview: {
    headers: CROSS_ORIGIN_ISOLATION_HEADERS
  }
})
