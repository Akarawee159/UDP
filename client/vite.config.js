// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// production server PORT: 3001
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3001,
  },
})