// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3091,
    // 👇 เพิ่มโดเมนใหม่ต่อท้ายใน Array ได้เลยครับ
    allowedHosts: [
      'spt.local', 
      'her09ecgc3k.sn.mynetname.net'
    ], 
    watch: {
      usePolling: true,
    },
  },
})