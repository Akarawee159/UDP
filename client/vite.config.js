// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3091,
    // เพิ่มส่วนนี้เพื่อให้ Docker จับการเปลี่ยนแปลงไฟล์ได้แม่นยำขึ้น
    watch: {
      usePolling: true,
    },
  },
})