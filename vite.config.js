import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

const pad = (value) => String(value).padStart(2, '0')
const now = new Date()
const buildStamp = [
  now.getUTCFullYear(),
  pad(now.getUTCMonth() + 1),
  pad(now.getUTCDate()),
].join('') + `.${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`

const resolveGitSha = () => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch (_error) {
    return 'nogit'
  }
}

const appVersion = String(packageJson.version || '0.0.0')
const appBuild = `${buildStamp}.${resolveGitSha()}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.VITE_APP_BUILD': JSON.stringify(appBuild),
  },
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
