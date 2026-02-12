import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Default to root for Firebase Hosting. Override with VITE_BASE_PATH when needed.
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          const packagePath = id.split('node_modules/')[1] || ''
          const [scopeOrName, maybeName] = packagePath.split('/')
          const packageName = scopeOrName?.startsWith('@')
            ? `${scopeOrName}/${maybeName || ''}`
            : scopeOrName
          if (!packageName) return 'vendor'
          if (['react', 'react-dom', 'scheduler'].includes(packageName)) return 'vendor-react'
          if (packageName === 'firebase') return 'vendor-firebase'
          if (packageName.startsWith('@firebase')) {
            const sanitizedFirebase = packageName.replace('@', '').replace('/', '-')
            return `vendor-${sanitizedFirebase}`
          }
          const sanitized = packageName.replace('@', '').replace('/', '-')
          return `vendor-${sanitized}`
        },
      },
    },
  },
})
