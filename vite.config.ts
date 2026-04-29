import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 线上部署时的配置
  preview: {
    port: parseInt(process.env.PORT || '80'),
    host: '0.0.0.0',
    allowedHosts: ['front-end-spqr.app.spring26b.secoder.net', '.secoder.net']
  }
})
