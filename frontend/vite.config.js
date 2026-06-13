import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // simple-peer (and other Node.js packages) use `global`
    // Vite runs in the browser where `global` doesn't exist — polyfill it
    global: 'globalThis',
  },
})
