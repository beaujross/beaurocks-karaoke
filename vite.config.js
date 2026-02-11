import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Default to root for Firebase Hosting. Override with VITE_BASE_PATH when needed.
  base: process.env.VITE_BASE_PATH || '/',
})
